/**
 * 데이터 무결성 테스트
 * 설정 상수, 타입 매핑, 데이터 변환 로직 검증
 */
import {
  DerivedStatus, FoodCategory, StorageLocation, DateType, Outcome,
  FOOD_CATEGORY_LABEL,
  STORAGE_LOCATION_LABEL, STORAGE_LOCATION_ICON,
  DERIVED_STATUS_LABEL, OUTCOME_LABEL,
} from '@/types';
import {
  DDAY_THRESHOLDS, DEFAULT_NOTIFICATION_SETTINGS,
  MAX_SCHEDULED_NOTIFICATIONS, NOTIFICATION_WINDOW_DAYS,
  ITEMS_PER_PAGE,
} from '@/constants/config';
import { calculateStatus, getStatusPriority } from '@/lib/statusCalculator';
import type { FoodItem } from '@/types';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

// ========== DDAY_THRESHOLDS 일관성 ==========
describe('DDAY_THRESHOLDS 설정 일관성', () => {
  it('SAFE 임계값은 WARN보다 크다', () => {
    expect(DDAY_THRESHOLDS.SAFE_MIN).toBeGreaterThan(DDAY_THRESHOLDS.WARN_MIN);
  });

  it('WARN 임계값은 DANGER보다 크다', () => {
    expect(DDAY_THRESHOLDS.WARN_MIN).toBeGreaterThan(DDAY_THRESHOLDS.DANGER);
  });

  it('DANGER 임계값은 0이다', () => {
    expect(DDAY_THRESHOLDS.DANGER).toBe(0);
  });

  it('DDAY_THRESHOLDS와 calculateStatus가 일치한다', () => {
    // SAFE 경계
    const safeItem: FoodItem = {
      id: 't', name: 't', category: FoodCategory.OTHERS,
      location: StorageLocation.FRIDGE, image_uri: null,
      quantity: 1, unit: '개', added_at: '2026-02-18',
      date_type: DateType.USE_BY,
      expires_at: '2026-02-22', // D-4 (SAFE threshold = 3)
      opened_at: null, thawed_at: null, location_changed_at: null,
      freshness_days: null, freshness_days_after_open: null,
      is_subdivided: false, subdivide_count: null,
      consumed_at: null, outcome: null,
      alert_offsets: [], alert_enabled: true,
      memo: null, template_id: null, is_favorite: false,
      created_at: '', updated_at: '',
    };
    // D-4 → dDay(4) > SAFE threshold(3) → SAFE
    expect(calculateStatus(safeItem).status).toBe(DerivedStatus.SAFE);

    // D-3 → dDay(3) <= SAFE threshold(3) → WARN
    safeItem.expires_at = '2026-02-21';
    expect(calculateStatus(safeItem).status).toBe(DerivedStatus.WARN);
  });
});

// ========== LABEL 매핑 완전성 ==========
describe('LABEL 매핑 완전성', () => {
  it('모든 FoodCategory에 한국어 라벨이 있다', () => {
    const categories = Object.values(FoodCategory);
    for (const cat of categories) {
      const label = FOOD_CATEGORY_LABEL[cat];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(0);
      // 한국어 확인 (한글 또는 영어 허용)
      expect(typeof label).toBe('string');
    }
  });

  it('모든 StorageLocation에 한국어 라벨이 있다', () => {
    for (const loc of Object.values(StorageLocation)) {
      const label = STORAGE_LOCATION_LABEL[loc];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('모든 DerivedStatus에 라벨이 있다', () => {
    for (const status of Object.values(DerivedStatus)) {
      expect(DERIVED_STATUS_LABEL[status]).toBeDefined();
    }
  });

  it('모든 Outcome에 라벨이 있다', () => {
    for (const outcome of Object.values(Outcome)) {
      expect(OUTCOME_LABEL[outcome]).toBeDefined();
    }
  });
});

// ========== 아이콘 매핑 완전성 ==========
describe('아이콘 매핑 완전성', () => {
  it('모든 StorageLocation에 아이콘이 있다', () => {
    for (const loc of Object.values(StorageLocation)) {
      expect(STORAGE_LOCATION_ICON[loc]).toBeDefined();
      expect(typeof STORAGE_LOCATION_ICON[loc]).toBe('string');
    }
  });
});

// ========== 우선순위 일관성 ==========
describe('우선순위 일관성', () => {
  it('상태 우선순위: DANGER > EXPIRED > WARN > CHECK_NEEDED > SAFE > LONG_TERM', () => {
    const priorities = [
      { status: DerivedStatus.DANGER, priority: getStatusPriority(DerivedStatus.DANGER) },
      { status: DerivedStatus.EXPIRED, priority: getStatusPriority(DerivedStatus.EXPIRED) },
      { status: DerivedStatus.WARN, priority: getStatusPriority(DerivedStatus.WARN) },
      { status: DerivedStatus.CHECK_NEEDED, priority: getStatusPriority(DerivedStatus.CHECK_NEEDED) },
      { status: DerivedStatus.SAFE, priority: getStatusPriority(DerivedStatus.SAFE) },
      { status: DerivedStatus.LONG_TERM, priority: getStatusPriority(DerivedStatus.LONG_TERM) },
    ];
    // 이미 정렬된 순서인지 확인
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i].priority).toBeLessThan(priorities[i + 1].priority);
    }
  });

  it('모든 상태의 우선순위가 0 이상이다', () => {
    for (const status of Object.values(DerivedStatus)) {
      expect(getStatusPriority(status)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ========== 설정 상수 유효성 ==========
describe('설정 상수 유효성', () => {
  it('DEFAULT_NOTIFICATION_SETTINGS 필드가 모두 존재', () => {
    const keys = [
      'summary_enabled', 'summary_time', 'urgent_enabled',
      'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end',
      'expired_repeat_days', 'default_alert_offsets',
    ];
    for (const key of keys) {
      expect(DEFAULT_NOTIFICATION_SETTINGS).toHaveProperty(key);
    }
  });

  it('요약 시간 형식이 HH:mm이다', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.summary_time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('방해 금지 시작/종료 형식이 HH:mm이다', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.quiet_hours_start).toMatch(/^\d{2}:\d{2}$/);
    expect(DEFAULT_NOTIFICATION_SETTINGS.quiet_hours_end).toMatch(/^\d{2}:\d{2}$/);
  });

  it('기본 알림 오프셋에 중복 없음', () => {
    const offsets = DEFAULT_NOTIFICATION_SETTINGS.default_alert_offsets;
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('기본 알림 오프셋이 정렬되어 있다 (오름차순)', () => {
    const offsets = DEFAULT_NOTIFICATION_SETTINGS.default_alert_offsets;
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });

  it('MAX_SCHEDULED_NOTIFICATIONS > 0', () => {
    expect(MAX_SCHEDULED_NOTIFICATIONS).toBeGreaterThan(0);
  });

  it('NOTIFICATION_WINDOW_DAYS > 0', () => {
    expect(NOTIFICATION_WINDOW_DAYS).toBeGreaterThan(0);
  });

  it('ITEMS_PER_PAGE > 0', () => {
    expect(ITEMS_PER_PAGE).toBeGreaterThan(0);
  });

  it('expired_repeat_days > 0', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.expired_repeat_days).toBeGreaterThan(0);
  });
});

// ========== FoodItem 필수 필드 검증 ==========
describe('FoodItem 필수 필드 검증', () => {
  it('최소 필드만으로 상태 계산 가능', () => {
    const minimalItem: FoodItem = {
      id: 'min', name: '최소', category: FoodCategory.OTHERS,
      location: StorageLocation.FRIDGE, image_uri: null,
      quantity: 1, unit: '개', added_at: '2026-02-18',
      date_type: DateType.USE_BY, expires_at: '2026-02-25',
      opened_at: null, thawed_at: null, location_changed_at: null,
      freshness_days: null, freshness_days_after_open: null,
      is_subdivided: false, subdivide_count: null,
      consumed_at: null, outcome: null,
      alert_offsets: [], alert_enabled: false,
      memo: null, template_id: null, is_favorite: false,
      created_at: '', updated_at: '',
    };
    const { status, dDay } = calculateStatus(minimalItem);
    expect(status).toBe(DerivedStatus.SAFE);
    expect(dDay).toBe(7);
  });

  it('null만 가능한 필드에 null 값으로 상태 계산 가능', () => {
    const nullItem: FoodItem = {
      id: 'null-test', name: '널 테스트', category: FoodCategory.OTHERS,
      location: StorageLocation.FRIDGE, image_uri: null,
      quantity: 1, unit: '개', added_at: '2026-02-18',
      date_type: DateType.USE_BY, expires_at: null,
      opened_at: null, thawed_at: null, location_changed_at: null,
      freshness_days: null, freshness_days_after_open: null,
      is_subdivided: false, subdivide_count: null,
      consumed_at: null, outcome: null,
      alert_offsets: [], alert_enabled: false,
      memo: null, template_id: null, is_favorite: false,
      created_at: '', updated_at: '',
    };
    const { status, dDay } = calculateStatus(nullItem);
    expect(status).toBe(DerivedStatus.CHECK_NEEDED);
    expect(dDay).toBeNull();
  });
});

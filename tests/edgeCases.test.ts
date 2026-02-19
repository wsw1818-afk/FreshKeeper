/**
 * 엣지 케이스 & 경계값 테스트
 * 실제 사용자가 만날 수 있는 극단적 상황 검증
 */
import {
  getToday, parseDate, formatDate, isValidDateString,
  calculateDDay, calculateExpiryDate,
  recalculateAfterOpen, recalculateAfterThaw,
  formatDDay, formatDisplayDate,
} from '@/lib/dateUtils';
import { calculateStatus, getStatusPriority } from '@/lib/statusCalculator';
import {
  DerivedStatus, FoodCategory, StorageLocation, DateType, Outcome,
  FOOD_CATEGORY_LABEL, STORAGE_LOCATION_LABEL, DERIVED_STATUS_LABEL,
  STORAGE_LOCATION_ICON, OUTCOME_LABEL,
} from '@/types';
import type { FoodItem } from '@/types';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

function createItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'edge-1', name: '엣지 테스트',
    category: FoodCategory.OTHERS, location: StorageLocation.FRIDGE,
    image_uri: null, quantity: 1, unit: '개',
    added_at: '2026-02-18', date_type: DateType.USE_BY,
    expires_at: '2026-02-25', opened_at: null, thawed_at: null,
    location_changed_at: null, freshness_days: 7, freshness_days_after_open: null,
    is_subdivided: false, subdivide_count: null,
    consumed_at: null, outcome: null,
    alert_offsets: [-3, -1, 0], alert_enabled: true,
    memo: null, template_id: null, is_favorite: false,
    created_at: '2026-02-18T00:00:00.000Z', updated_at: '2026-02-18T00:00:00.000Z',
    ...overrides,
  };
}

// ========== 날짜 경계값 ==========
describe('날짜 경계값', () => {
  it('윤년 2월 29일 처리', () => {
    // 2028년은 윤년
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(calculateExpiryDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(calculateExpiryDate('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('비윤년 2월 29일은 무효', () => {
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2027-02-29')).toBe(false);
  });

  it('연도 경계: 12/31 → 1/1', () => {
    expect(calculateExpiryDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(calculateExpiryDate('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('월 경계: 1/30 → 2/2', () => {
    expect(calculateExpiryDate('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('2월 말 경계: 2/26 + 3일 → 3/1', () => {
    expect(calculateExpiryDate('2026-02-26', 3)).toBe('2026-03-01');
  });

  it('극단적으로 긴 보관일: 365일', () => {
    const result = calculateExpiryDate('2026-02-18', 365);
    expect(result).toBe('2027-02-18');
  });

  it('음수 보관일은 과거 날짜 반환', () => {
    const result = calculateExpiryDate('2026-02-18', -1);
    expect(result).toBe('2026-02-17');
  });
});

// ========== D-Day 극단값 ==========
describe('D-Day 극단값', () => {
  it('1년 뒤 만료: D-365', () => {
    const dDay = calculateDDay('2027-02-18');
    expect(dDay).toBe(365);
  });

  it('1년 전 만료: D+365', () => {
    const dDay = calculateDDay('2025-02-18');
    expect(dDay).toBe(-365);
  });

  it('정확히 오늘: D-0', () => {
    expect(calculateDDay('2026-02-18')).toBe(0);
  });

  it('formatDDay 극단값', () => {
    expect(formatDDay(365)).toBe('D-365');
    expect(formatDDay(-365)).toBe('D+365');
    expect(formatDDay(0)).toBe('D-Day');
  });
});

// ========== 개봉/해동 엣지 케이스 ==========
describe('개봉/해동 엣지 케이스', () => {
  it('개봉일 = 만료일: 기존 만료일(=오늘) 유지', () => {
    const result = recalculateAfterOpen('2026-02-18', '2026-02-18', 3);
    // 개봉+3 = 2/21 vs 기존 2/18 → 빠른 쪽: 2/18
    expect(result).toBe('2026-02-18');
  });

  it('이미 만료된 상태에서 개봉: 기존 만료일 유지', () => {
    const result = recalculateAfterOpen('2026-02-15', '2026-02-18', 3);
    // 개봉+3 = 2/21 vs 기존 2/15 → 빠른 쪽: 2/15
    expect(result).toBe('2026-02-15');
  });

  it('개봉 후 보관일 0일: 개봉 당일 만료', () => {
    const result = recalculateAfterOpen('2026-03-01', '2026-02-18', 0);
    // 개봉+0 = 2/18 vs 기존 3/01 → 빠른 쪽: 2/18
    expect(result).toBe('2026-02-18');
  });

  it('해동 후 보관일 0일: 해동 당일 만료', () => {
    expect(recalculateAfterThaw('2026-02-18', 0)).toBe('2026-02-18');
  });

  it('기존 만료일 null + 개봉: 개봉+보관일 반환', () => {
    const result = recalculateAfterOpen(null, '2026-02-18', 5);
    expect(result).toBe('2026-02-23');
  });
});

// ========== 상태 계산 엣지 케이스 ==========
describe('상태 계산 엣지 케이스', () => {
  it('모든 DerivedStatus에 대해 LABEL이 존재한다', () => {
    for (const status of Object.values(DerivedStatus)) {
      expect(DERIVED_STATUS_LABEL[status]).toBeDefined();
      expect(typeof DERIVED_STATUS_LABEL[status]).toBe('string');
      expect(DERIVED_STATUS_LABEL[status].length).toBeGreaterThan(0);
    }
  });

  it('소비 완료 아이템 (EAT): EXPIRED 반환, dDay null', () => {
    const item = createItem({ consumed_at: '2026-02-17', outcome: Outcome.EAT });
    const { status, dDay } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.EXPIRED);
    expect(dDay).toBeNull();
  });

  it('폐기 완료 아이템 (DISCARD): EXPIRED 반환', () => {
    const item = createItem({ consumed_at: '2026-02-17', outcome: Outcome.DISCARD });
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.EXPIRED);
  });

  it('나눔 완료 아이템 (SHARE): EXPIRED 반환', () => {
    const item = createItem({ consumed_at: '2026-02-17', outcome: Outcome.SHARE });
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.EXPIRED);
  });

  it('발효식품 + 만료일 null: LONG_TERM', () => {
    const item = createItem({ category: FoodCategory.FERMENTED, expires_at: null });
    expect(calculateStatus(item).status).toBe(DerivedStatus.LONG_TERM);
  });

  it('발효식품 + D-31: LONG_TERM', () => {
    const item = createItem({ category: FoodCategory.FERMENTED, expires_at: '2026-03-21' });
    expect(calculateStatus(item).status).toBe(DerivedStatus.LONG_TERM);
  });

  it('발효식품 + D-30: SAFE (LONG_TERM 경계)', () => {
    const item = createItem({ category: FoodCategory.FERMENTED, expires_at: '2026-03-20' });
    expect(calculateStatus(item).status).toBe(DerivedStatus.SAFE);
  });

  it('비발효 식품 + 만료일 null: CHECK_NEEDED', () => {
    const item = createItem({ category: FoodCategory.VEGETABLE, expires_at: null });
    expect(calculateStatus(item).status).toBe(DerivedStatus.CHECK_NEEDED);
  });

  it('D-Day 경계: SAFE/WARN = 4/3', () => {
    const safeItem = createItem({ expires_at: '2026-02-22' }); // D-4
    const warnItem = createItem({ expires_at: '2026-02-21' }); // D-3
    expect(calculateStatus(safeItem).status).toBe(DerivedStatus.SAFE);
    expect(calculateStatus(warnItem).status).toBe(DerivedStatus.WARN);
  });

  it('D-Day 경계: WARN/DANGER = 1/0', () => {
    const warnItem = createItem({ expires_at: '2026-02-19' }); // D-1
    const dangerItem = createItem({ expires_at: '2026-02-18' }); // D-0
    expect(calculateStatus(warnItem).status).toBe(DerivedStatus.WARN);
    expect(calculateStatus(dangerItem).status).toBe(DerivedStatus.DANGER);
  });

  it('D-Day 경계: DANGER/EXPIRED = 0/-1', () => {
    const dangerItem = createItem({ expires_at: '2026-02-18' }); // D-0
    const expiredItem = createItem({ expires_at: '2026-02-17' }); // D-(-1)
    expect(calculateStatus(dangerItem).status).toBe(DerivedStatus.DANGER);
    expect(calculateStatus(expiredItem).status).toBe(DerivedStatus.EXPIRED);
  });
});

// ========== 타입/Enum 완전성 ==========
describe('타입/Enum 완전성', () => {
  it('FoodCategory 16개 존재', () => {
    expect(Object.values(FoodCategory)).toHaveLength(16);
  });

  it('모든 FoodCategory에 LABEL이 있다', () => {
    for (const cat of Object.values(FoodCategory)) {
      expect(FOOD_CATEGORY_LABEL[cat]).toBeDefined();
      expect(typeof FOOD_CATEGORY_LABEL[cat]).toBe('string');
    }
  });

  it('StorageLocation 4개 존재', () => {
    const locations = Object.values(StorageLocation);
    expect(locations).toHaveLength(4);
    expect(locations).toContain(StorageLocation.FRIDGE);
    expect(locations).toContain(StorageLocation.FREEZER);
    expect(locations).toContain(StorageLocation.PANTRY);
    expect(locations).toContain(StorageLocation.KIMCHI_FRIDGE);
  });

  it('모든 StorageLocation에 LABEL이 있다', () => {
    for (const loc of Object.values(StorageLocation)) {
      expect(STORAGE_LOCATION_LABEL[loc]).toBeDefined();
    }
  });

  it('모든 StorageLocation에 ICON이 있다', () => {
    for (const loc of Object.values(StorageLocation)) {
      expect(STORAGE_LOCATION_ICON[loc]).toBeDefined();
    }
  });

  it('DateType 4개 존재', () => {
    expect(Object.values(DateType)).toHaveLength(4);
  });

  it('Outcome 3개 존재', () => {
    const outcomes = Object.values(Outcome);
    expect(outcomes).toHaveLength(3);
    expect(outcomes).toContain(Outcome.EAT);
    expect(outcomes).toContain(Outcome.DISCARD);
    expect(outcomes).toContain(Outcome.SHARE);
  });

  it('모든 Outcome에 LABEL이 있다', () => {
    for (const o of Object.values(Outcome)) {
      expect(OUTCOME_LABEL[o]).toBeDefined();
    }
  });

  it('DerivedStatus 6개 존재', () => {
    expect(Object.values(DerivedStatus)).toHaveLength(6);
  });

  it('모든 DerivedStatus에 고유한 우선순위가 있다', () => {
    const priorities = Object.values(DerivedStatus).map(getStatusPriority);
    const unique = new Set(priorities);
    expect(unique.size).toBe(priorities.length);
  });
});

// ========== 날짜 유효성 검증 엣지 케이스 ==========
describe('날짜 유효성 엣지 케이스', () => {
  it('유효한 날짜들', () => {
    expect(isValidDateString('2026-01-01')).toBe(true);
    expect(isValidDateString('2026-12-31')).toBe(true);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2000-01-01')).toBe(true);
    expect(isValidDateString('2099-12-31')).toBe(true);
  });

  it('존재하지 않는 날짜', () => {
    expect(isValidDateString('2026-02-30')).toBe(false); // 2월 30일
    expect(isValidDateString('2026-04-31')).toBe(false); // 4월 31일
    expect(isValidDateString('2026-06-31')).toBe(false); // 6월 31일
    expect(isValidDateString('2026-13-01')).toBe(false); // 13월
    expect(isValidDateString('2026-00-01')).toBe(false); // 0월
    expect(isValidDateString('2026-01-00')).toBe(false); // 0일
    expect(isValidDateString('2026-01-32')).toBe(false); // 32일
  });

  it('잘못된 형식', () => {
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('abc')).toBe(false);
    expect(isValidDateString('2026/02/18')).toBe(false);
    expect(isValidDateString('18-02-2026')).toBe(false);
    expect(isValidDateString('2026-2-18')).toBe(false); // 제로 패딩 누락
    expect(isValidDateString('2026-02-8')).toBe(false);
  });
});

// ========== formatDisplayDate 엣지 케이스 ==========
describe('formatDisplayDate 엣지 케이스', () => {
  it('각 월의 1일', () => {
    expect(formatDisplayDate('2026-01-01')).toBe('1월 1일');
    expect(formatDisplayDate('2026-06-01')).toBe('6월 1일');
    expect(formatDisplayDate('2026-12-01')).toBe('12월 1일');
  });

  it('월말 날짜', () => {
    expect(formatDisplayDate('2026-01-31')).toBe('1월 31일');
    expect(formatDisplayDate('2026-02-28')).toBe('2월 28일');
    expect(formatDisplayDate('2026-12-31')).toBe('12월 31일');
  });
});

// ========== 보관 장소 변경 시나리오 ==========
describe('보관 장소 변경 시나리오', () => {
  it('냉장→냉동: 위치 변경 시 expires_at 재계산 필요', () => {
    const item = createItem({
      location: StorageLocation.FRIDGE,
      expires_at: '2026-02-25', // 냉장 7일
    });
    // 냉동으로 옮기면 보관일이 길어짐 → 새 만료일 계산
    const newExpiry = calculateExpiryDate(getToday(), 90);
    expect(newExpiry).toBe('2026-05-19');
    // 새 만료일이 기존보다 훨씬 길다
    expect(newExpiry > item.expires_at!).toBe(true);
  });

  it('냉동→냉장(해동): expires_at을 짧게 재설정', () => {
    const thawExpiry = recalculateAfterThaw(getToday(), 2);
    expect(thawExpiry).toBe('2026-02-20');
  });
});

// ========== 수량 관련 ==========
describe('수량 관련', () => {
  it('수량 0인 아이템도 상태 계산 가능', () => {
    const item = createItem({ quantity: 0 });
    const { status } = calculateStatus(item);
    expect(status).toBeDefined();
  });

  it('다양한 단위 지원', () => {
    const units = ['개', 'kg', 'g', 'L', 'mL', '봉', '팩', '줄', '병', '캔'];
    for (const unit of units) {
      const item = createItem({ unit });
      expect(item.unit).toBe(unit);
    }
  });
});

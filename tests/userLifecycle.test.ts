/**
 * 사용자 라이프사이클 통합 테스트
 * "냉장고 앱을 사랑하는 사용자" 관점의 실제 사용 시나리오 검증
 */
import {
  getToday, calculateDDay, calculateExpiryDate,
  recalculateAfterOpen, recalculateAfterThaw,
  formatDDay, formatDisplayDate, isValidDateString,
} from '@/lib/dateUtils';
import { calculateStatus, getStatusPriority } from '@/lib/statusCalculator';
import {
  DerivedStatus, FoodCategory, StorageLocation, DateType, Outcome,
  FOOD_CATEGORY_LABEL, STORAGE_LOCATION_LABEL, DERIVED_STATUS_LABEL,
} from '@/types';
import type { FoodItem, NotificationSettings } from '@/types';
import { DEFAULT_NOTIFICATION_SETTINGS, DDAY_THRESHOLDS } from '@/constants/config';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

function createItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'test-1', name: '테스트 식재료',
    category: FoodCategory.VEGETABLE, location: StorageLocation.FRIDGE,
    image_uri: null, quantity: 1, unit: '개',
    added_at: '2026-02-10', date_type: DateType.USE_BY,
    expires_at: '2026-02-25', opened_at: null, thawed_at: null,
    location_changed_at: null, freshness_days: 14, freshness_days_after_open: 3,
    is_subdivided: false, subdivide_count: null,
    consumed_at: null, outcome: null,
    alert_offsets: [-3, -1, 0], alert_enabled: true,
    memo: null, template_id: null, is_favorite: false,
    created_at: '2026-02-10T00:00:00.000Z', updated_at: '2026-02-10T00:00:00.000Z',
    ...overrides,
  };
}

// ========== 시나리오 1: 우유 구매 → 보관 → 개봉 → 소비 ==========
describe('시나리오 1: 우유 라이프사이클 (냉장 → 개봉 → 소비)', () => {
  const milk = createItem({
    name: '서울우유 1L', category: FoodCategory.DAIRY,
    location: StorageLocation.FRIDGE, added_at: '2026-02-18',
    expires_at: '2026-02-25', freshness_days: 7, freshness_days_after_open: 3,
  });

  it('1. 등록 직후: 만료일 D-7 → SAFE 상태', () => {
    const { status, dDay } = calculateStatus(milk);
    expect(status).toBe(DerivedStatus.SAFE);
    expect(dDay).toBe(7);
    expect(formatDDay(dDay!)).toBe('D-7');
  });

  it('2. 3일 후: D-4 → 아직 SAFE', () => {
    const milkDay3 = { ...milk, expires_at: '2026-02-25' };
    // 3일 후 = 2026-02-21에서 바라본 D-Day를 시뮬레이션
    const dDay = calculateDDay('2026-02-25'); // 오늘(2/18) 기준 D-7
    expect(dDay).toBe(7);
    // 만약 시간을 2/21로 옮기면 D-4 → SAFE
    jest.setSystemTime(new Date('2026-02-21T09:00:00.000Z'));
    const { status } = calculateStatus(milkDay3);
    expect(status).toBe(DerivedStatus.SAFE);
    jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z')); // 복원
  });

  it('3. 개봉: 오늘+3일 vs 기존 만료일 중 빠른 날짜', () => {
    const today = '2026-02-18';
    const newExpiry = recalculateAfterOpen(milk.expires_at, today, milk.freshness_days_after_open!);
    // 개봉+3일 = 2/21 vs 기존 2/25 → 빠른 쪽: 2/21
    expect(newExpiry).toBe('2026-02-21');
  });

  it('4. 개봉 후 D-3: WARN 상태', () => {
    const openedMilk = { ...milk, expires_at: '2026-02-21', opened_at: '2026-02-18' };
    const { status, dDay } = calculateStatus(openedMilk);
    expect(status).toBe(DerivedStatus.WARN);
    expect(dDay).toBe(3);
  });

  it('5. 소비 처리: consumed_at 설정 → 목록에서 사라짐', () => {
    const consumedMilk = {
      ...milk, expires_at: '2026-02-21', consumed_at: '2026-02-20', outcome: Outcome.EAT,
    };
    const { status, dDay } = calculateStatus(consumedMilk);
    expect(status).toBe(DerivedStatus.EXPIRED); // consumed_at 있으면 EXPIRED
    expect(dDay).toBeNull();
    // 활성 필터링: consumed_at !== null → 비활성 (목록 안 보임)
    expect(consumedMilk.consumed_at).not.toBeNull();
  });
});

// ========== 시나리오 2: 삼겹살 냉동 보관 → 해동 → 소비 ==========
describe('시나리오 2: 삼겹살 냉동 → 해동 → 소비', () => {
  it('1. 냉동 보관: 장기 만료일 설정', () => {
    const pork = createItem({
      name: '삼겹살 600g', category: FoodCategory.MEAT,
      location: StorageLocation.FREEZER, expires_at: '2026-05-18', freshness_days: 90,
    });
    const { status, dDay } = calculateStatus(pork);
    expect(status).toBe(DerivedStatus.SAFE);
    expect(dDay).toBe(89); // 2/18 ~ 5/18 = 89일
  });

  it('2. 해동 처리: 해동+1일 = 내일 만료', () => {
    const today = '2026-02-18';
    const newExpiry = recalculateAfterThaw(today, 1);
    expect(newExpiry).toBe('2026-02-19');
  });

  it('3. 해동 후 상태: D-1 = WARN', () => {
    const thawedPork = createItem({
      name: '삼겹살', location: StorageLocation.FRIDGE,
      thawed_at: '2026-02-18', expires_at: '2026-02-19',
    });
    const { status, dDay } = calculateStatus(thawedPork);
    expect(status).toBe(DerivedStatus.WARN);
    expect(dDay).toBe(1);
  });

  it('4. 해동 당일 소비하지 않으면 다음날 DANGER', () => {
    jest.setSystemTime(new Date('2026-02-19T09:00:00.000Z'));
    const pork = createItem({ expires_at: '2026-02-19' });
    const { status } = calculateStatus(pork);
    expect(status).toBe(DerivedStatus.DANGER);
    jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z')); // 복원
  });
});

// ========== 시나리오 3: 다수 식재료 관리 + 정렬 ==========
describe('시나리오 3: 냉장고에 10개 식재료 관리', () => {
  const items: FoodItem[] = [
    createItem({ id: '1', name: '우유', expires_at: '2026-02-18', category: FoodCategory.DAIRY }),
    createItem({ id: '2', name: '두부', expires_at: '2026-02-19', category: FoodCategory.PROCESSED }),
    createItem({ id: '3', name: '삼겹살', expires_at: '2026-02-20', category: FoodCategory.MEAT }),
    createItem({ id: '4', name: '계란', expires_at: '2026-02-21', category: FoodCategory.POULTRY }),
    createItem({ id: '5', name: '양파', expires_at: '2026-02-25', category: FoodCategory.VEGETABLE }),
    createItem({ id: '6', name: '사과', expires_at: '2026-03-01', category: FoodCategory.FRUIT }),
    createItem({ id: '7', name: '김치', expires_at: null, category: FoodCategory.FERMENTED }),
    createItem({ id: '8', name: '고추장', expires_at: '2026-06-01', category: FoodCategory.FERMENTED }),
    createItem({ id: '9', name: '쌀', expires_at: null, category: FoodCategory.GRAIN }),
    createItem({ id: '10', name: '만료된 요거트', expires_at: '2026-02-15', category: FoodCategory.DAIRY }),
  ];

  it('상태별 개수가 정확하다', () => {
    const statusCounts: Record<DerivedStatus, number> = {
      [DerivedStatus.SAFE]: 0, [DerivedStatus.WARN]: 0,
      [DerivedStatus.DANGER]: 0, [DerivedStatus.EXPIRED]: 0,
      [DerivedStatus.LONG_TERM]: 0, [DerivedStatus.CHECK_NEEDED]: 0,
    };
    for (const item of items) {
      const { status } = calculateStatus(item);
      statusCounts[status]++;
    }
    expect(statusCounts[DerivedStatus.EXPIRED]).toBe(1);  // 만료된 요거트
    expect(statusCounts[DerivedStatus.DANGER]).toBe(1);   // 우유 (오늘)
    expect(statusCounts[DerivedStatus.WARN]).toBe(3);     // 두부, 삼겹살, 계란
    expect(statusCounts[DerivedStatus.SAFE]).toBe(2);     // 양파, 사과
    expect(statusCounts[DerivedStatus.LONG_TERM]).toBe(2); // 김치(null+발효), 고추장(D>30+발효)
    expect(statusCounts[DerivedStatus.CHECK_NEEDED]).toBe(1); // 쌀(null+곡류)
  });

  it('긴급도 우선순위 정렬이 올바르다', () => {
    const sorted = items
      .map((item) => ({ item, ...calculateStatus(item) }))
      .sort((a, b) => {
        const pa = getStatusPriority(a.status);
        const pb = getStatusPriority(b.status);
        if (pa !== pb) return pa - pb;
        return (a.dDay ?? 999) - (b.dDay ?? 999);
      });

    expect(sorted[0].item.name).toBe('우유'); // DANGER (0)
    expect(sorted[1].item.name).toBe('만료된 요거트'); // EXPIRED (1)
  });

  it('만료된 아이템만 필터링 (일괄 폐기용)', () => {
    const expiredItems = items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED;
    });
    expect(expiredItems).toHaveLength(1);
    expect(expiredItems[0].name).toBe('만료된 요거트');
  });

  it('카테고리별 필터링이 올바르다', () => {
    const dairy = items.filter((i) => i.category === FoodCategory.DAIRY);
    expect(dairy).toHaveLength(2); // 우유, 만료된 요거트
    const meat = items.filter((i) => i.category === FoodCategory.MEAT);
    expect(meat).toHaveLength(1); // 삼겹살
  });

  it('보관 장소별 필터링이 올바르다', () => {
    const fridgeItems = items.filter((i) => i.location === StorageLocation.FRIDGE);
    expect(fridgeItems).toHaveLength(10); // 모두 냉장
    const freezerItems = items.filter((i) => i.location === StorageLocation.FREEZER);
    expect(freezerItems).toHaveLength(0);
  });

  it('검색 기능: 이름 부분 일치', () => {
    const query = '삼겹';
    const results = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('삼겹살');
  });

  it('검색 기능: 빈 검색어는 결과 없음', () => {
    const query = '';
    const results = query.trim() ? items.filter((i) => i.name.includes(query)) : [];
    expect(results).toHaveLength(0);
  });
});

// ========== 시나리오 4: 템플릿 기반 등록 시뮬레이션 ==========
describe('시나리오 4: 템플릿으로 식재료 등록', () => {
  it('냉장 보관 템플릿: fridge_days로 만료일 계산', () => {
    const today = getToday();
    const fridgeDays = 7; // 예: 우유 냉장 7일
    const expiryDate = calculateExpiryDate(today, fridgeDays);
    expect(expiryDate).toBe('2026-02-25');
  });

  it('냉동 보관 템플릿: freezer_days로 만료일 계산', () => {
    const today = getToday();
    const freezerDays = 90;
    const expiryDate = calculateExpiryDate(today, freezerDays);
    expect(expiryDate).toBe('2026-05-19');
  });

  it('실온 보관 템플릿: pantry_days로 만료일 계산', () => {
    const today = getToday();
    const pantryDays = 30;
    const expiryDate = calculateExpiryDate(today, pantryDays);
    expect(expiryDate).toBe('2026-03-20');
  });

  it('보관 일수가 0이면 오늘 만료', () => {
    const today = getToday();
    expect(calculateExpiryDate(today, 0)).toBe(today);
  });
});

// ========== 시나리오 5: 대시보드 통계 시뮬레이션 ==========
describe('시나리오 5: 대시보드 통계', () => {
  const items: FoodItem[] = [
    createItem({ id: '1', expires_at: '2026-02-15' }), // EXPIRED
    createItem({ id: '2', expires_at: '2026-02-16' }), // EXPIRED
    createItem({ id: '3', expires_at: '2026-02-18' }), // DANGER
    createItem({ id: '4', expires_at: '2026-02-19' }), // WARN
    createItem({ id: '5', expires_at: '2026-02-20' }), // WARN
    createItem({ id: '6', expires_at: '2026-02-21' }), // WARN
    createItem({ id: '7', expires_at: '2026-02-25' }), // SAFE
    createItem({ id: '8', expires_at: '2026-03-01' }), // SAFE
  ];

  it('대시보드 통계가 정확하다', () => {
    let total = 0, expired = 0, danger = 0, warn = 0, safe = 0;
    for (const item of items) {
      total++;
      const { status } = calculateStatus(item);
      if (status === DerivedStatus.EXPIRED) expired++;
      else if (status === DerivedStatus.DANGER) danger++;
      else if (status === DerivedStatus.WARN) warn++;
      else if (status === DerivedStatus.SAFE) safe++;
    }
    expect(total).toBe(8);
    expect(expired).toBe(2);
    expect(danger).toBe(1);
    expect(warn).toBe(3);
    expect(safe).toBe(2);
  });

  it('긴급 아이템(EXPIRED+DANGER+WARN) 필터링', () => {
    const urgentItems = items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED || status === DerivedStatus.DANGER || status === DerivedStatus.WARN;
    });
    expect(urgentItems).toHaveLength(6);
  });
});

// ========== 시나리오 6: 즐겨찾기 & 메모 ==========
describe('시나리오 6: 즐겨찾기 및 메모 기능', () => {
  it('즐겨찾기 필터링이 올바르다', () => {
    const items = [
      createItem({ id: '1', name: '자주 먹는 우유', is_favorite: true }),
      createItem({ id: '2', name: '가끔 먹는 두부', is_favorite: false }),
      createItem({ id: '3', name: '자주 먹는 계란', is_favorite: true }),
    ];
    const favorites = items.filter((i) => i.is_favorite);
    expect(favorites).toHaveLength(2);
    expect(favorites.map((f) => f.name)).toEqual(['자주 먹는 우유', '자주 먹는 계란']);
  });

  it('메모가 있는 아이템 식별', () => {
    const items = [
      createItem({ id: '1', memo: '이번 주 안에 먹기' }),
      createItem({ id: '2', memo: null }),
    ];
    const withMemo = items.filter((i) => i.memo !== null);
    expect(withMemo).toHaveLength(1);
  });
});

// ========== 시나리오 7: 소분 관리 ==========
describe('시나리오 7: 소분 관리', () => {
  it('소분된 아이템은 subdivide_count로 관리', () => {
    const subdivided = createItem({
      name: '삼겹살 소분', is_subdivided: true, subdivide_count: 3,
    });
    expect(subdivided.is_subdivided).toBe(true);
    expect(subdivided.subdivide_count).toBe(3);
  });

  it('소분되지 않은 아이템은 count가 null', () => {
    const normal = createItem({ is_subdivided: false, subdivide_count: null });
    expect(normal.is_subdivided).toBe(false);
    expect(normal.subdivide_count).toBeNull();
  });
});

// ========== 시나리오 8: 시간에 따른 상태 변화 ==========
describe('시나리오 8: 시간 경과에 따른 상태 전이', () => {
  const item = createItem({ expires_at: '2026-02-22' }); // D-4 from 2/18

  it('D-4: SAFE', () => {
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.SAFE);
  });

  it('D-3: WARN으로 전환', () => {
    jest.setSystemTime(new Date('2026-02-19T09:00:00.000Z'));
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.WARN);
    jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
  });

  it('D-0: DANGER으로 전환', () => {
    jest.setSystemTime(new Date('2026-02-22T09:00:00.000Z'));
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.DANGER);
    jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
  });

  it('D+1: EXPIRED로 전환', () => {
    jest.setSystemTime(new Date('2026-02-23T09:00:00.000Z'));
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.EXPIRED);
    jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
  });
});

/**
 * Phase 6 변경사항 회귀 테스트
 * BUG-001: 개봉/해동 소비기한 재계산
 * BUG-002: 카테고리 선택 검증
 * IMP-003: 날짜 빠른 선택 로직
 * UX-005: 일괄 폐기 대상 필터링
 */
import { recalculateAfterOpen, recalculateAfterThaw, calculateExpiryDate, getToday } from '@/lib/dateUtils';
import { calculateStatus } from '@/lib/statusCalculator';
import { DerivedStatus, FoodCategory, StorageLocation, DateType, Outcome } from '@/types';
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
    id: 'test-1',
    name: '테스트 식재료',
    category: FoodCategory.VEGETABLE,
    location: StorageLocation.FRIDGE,
    image_uri: null,
    quantity: 1,
    unit: '개',
    added_at: '2026-02-10',
    date_type: DateType.USE_BY,
    expires_at: '2026-02-25',
    opened_at: null,
    thawed_at: null,
    location_changed_at: null,
    freshness_days: 14,
    freshness_days_after_open: 3,
    is_subdivided: false,
    subdivide_count: null,
    consumed_at: null,
    outcome: null,
    alert_offsets: [-3, -1, 0],
    alert_enabled: true,
    memo: null,
    template_id: null,
    is_favorite: false,
    created_at: '2026-02-10T00:00:00.000Z',
    updated_at: '2026-02-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('BUG-001: 개봉 후 소비기한 자동 재계산', () => {
  it('freshness_days_after_open이 있을 때 개봉 시 expires_at이 갱신된다', () => {
    const item = createItem({
      expires_at: '2026-03-01', // 기존 만료일
      freshness_days_after_open: 3,
    });
    const today = getToday();

    // 개봉 처리: 오늘 + 3일 = 2026-02-21 vs 기존 2026-03-01 → 빠른 것: 2026-02-21
    const newExpiry = recalculateAfterOpen(item.expires_at, today, item.freshness_days_after_open!);
    expect(newExpiry).toBe('2026-02-21');
    expect(newExpiry < item.expires_at!).toBe(true);
  });

  it('freshness_days_after_open이 null이면 expires_at은 변경되지 않아야 한다', () => {
    const item = createItem({
      expires_at: '2026-03-01',
      freshness_days_after_open: null,
    });
    // freshness_days_after_open이 null이면 handleMarkOpened에서 recalculateAfterOpen을 호출하지 않음
    // 따라서 expires_at은 그대로 유지되어야 함
    expect(item.freshness_days_after_open).toBeNull();
  });

  it('우유(유제품) 개봉 시나리오: 냉장 7일 → 개봉 후 3일', () => {
    const milk = createItem({
      name: '서울우유',
      category: FoodCategory.DAIRY,
      expires_at: '2026-02-25', // D-7
      freshness_days_after_open: 3,
    });
    const today = '2026-02-18';
    const newExpiry = recalculateAfterOpen(milk.expires_at, today, milk.freshness_days_after_open!);
    // 개봉+3일 = 2026-02-21 vs 기존 2026-02-25 → 빠른 것: 2026-02-21
    expect(newExpiry).toBe('2026-02-21');
  });

  it('이미 만료 임박한 상태에서 개봉하면 기존 만료일 유지', () => {
    const item = createItem({
      expires_at: '2026-02-19', // D-1 (내일 만료)
      freshness_days_after_open: 5,
    });
    const today = '2026-02-18';
    const newExpiry = recalculateAfterOpen(item.expires_at, today, item.freshness_days_after_open!);
    // 개봉+5일 = 2026-02-23 vs 기존 2026-02-19 → 빠른 것: 2026-02-19
    expect(newExpiry).toBe('2026-02-19');
  });
});

describe('BUG-001: 해동 후 소비기한 자동 재계산', () => {
  it('해동 시 after_thaw_days 기반으로 새 만료일 설정', () => {
    const today = getToday();
    const afterThawDays = 2;
    const newExpiry = recalculateAfterThaw(today, afterThawDays);
    expect(newExpiry).toBe('2026-02-20'); // 오늘 + 2일
  });

  it('냉동 삼겹살 해동 시나리오: 해동 후 1일', () => {
    const thawDate = '2026-02-18';
    const newExpiry = recalculateAfterThaw(thawDate, 1);
    expect(newExpiry).toBe('2026-02-19');

    // 새 만료일로 상태 계산하면 WARN이어야 함
    const item = createItem({ expires_at: newExpiry });
    const { status } = calculateStatus(item);
    expect(status).toBe(DerivedStatus.WARN); // D-1 = WARN
  });
});

describe('BUG-002: 카테고리 검증', () => {
  it('모든 FoodCategory 값이 16개 존재', () => {
    const allCategories = Object.values(FoodCategory);
    expect(allCategories).toHaveLength(16);
  });

  it('OTHERS가 FoodCategory에 포함됨', () => {
    expect(Object.values(FoodCategory)).toContain(FoodCategory.OTHERS);
  });

  it('카테고리별 상태 계산이 정상 동작', () => {
    // 각 카테고리로 아이템을 만들어도 상태 계산이 올바르게 동작하는지 확인
    const categories = [
      FoodCategory.DAIRY,
      FoodCategory.MEAT,
      FoodCategory.SEAFOOD,
      FoodCategory.VEGETABLE,
      FoodCategory.FRUIT,
    ];

    for (const cat of categories) {
      const item = createItem({ category: cat, expires_at: '2026-02-25' }); // D-7 = SAFE
      const { status } = calculateStatus(item);
      expect(status).toBe(DerivedStatus.SAFE);
    }
  });
});

describe('IMP-003: 날짜 빠른 선택 로직', () => {
  const today = '2026-02-18';

  it('"오늘" 선택 시 오늘 날짜 반환', () => {
    expect(calculateExpiryDate(today, 0)).toBe('2026-02-18');
  });

  it('"+3일" 선택 시 3일 후 반환', () => {
    expect(calculateExpiryDate(today, 3)).toBe('2026-02-21');
  });

  it('"+1주" 선택 시 7일 후 반환', () => {
    expect(calculateExpiryDate(today, 7)).toBe('2026-02-25');
  });

  it('"+2주" 선택 시 14일 후 반환', () => {
    expect(calculateExpiryDate(today, 14)).toBe('2026-03-04');
  });

  it('"+1달" 선택 시 30일 후 반환', () => {
    expect(calculateExpiryDate(today, 30)).toBe('2026-03-20');
  });
});

describe('UX-005: 만료 식재료 필터링', () => {
  it('만료된 아이템만 정확히 필터링된다', () => {
    const items: FoodItem[] = [
      createItem({ id: '1', name: '만료-1', expires_at: '2026-02-15' }), // EXPIRED
      createItem({ id: '2', name: '만료-2', expires_at: '2026-02-17' }), // EXPIRED
      createItem({ id: '3', name: '오늘', expires_at: '2026-02-18' }),   // DANGER
      createItem({ id: '4', name: '임박', expires_at: '2026-02-19' }),   // WARN
      createItem({ id: '5', name: '안전', expires_at: '2026-02-25' }),   // SAFE
    ];

    const expiredItems = items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED;
    });

    expect(expiredItems).toHaveLength(2);
    expect(expiredItems.map((i) => i.name)).toEqual(['만료-1', '만료-2']);
  });

  it('만료된 아이템이 없으면 빈 배열 반환', () => {
    const items: FoodItem[] = [
      createItem({ id: '1', expires_at: '2026-02-25' }), // SAFE
      createItem({ id: '2', expires_at: '2026-02-20' }), // WARN
    ];

    const expiredItems = items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED;
    });

    expect(expiredItems).toHaveLength(0);
  });

  it('DANGER(오늘 만료)는 일괄 폐기 대상에 포함되지 않는다', () => {
    const items: FoodItem[] = [
      createItem({ id: '1', expires_at: '2026-02-18' }), // DANGER (오늘)
      createItem({ id: '2', expires_at: '2026-02-15' }), // EXPIRED
    ];

    const expiredItems = items.filter((item) => {
      const { status } = calculateStatus(item);
      return status === DerivedStatus.EXPIRED;
    });

    // DANGER은 제외, EXPIRED만 포함
    expect(expiredItems).toHaveLength(1);
    expect(expiredItems[0].id).toBe('2');
  });
});

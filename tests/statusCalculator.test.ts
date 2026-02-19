/**
 * statusCalculator.ts 단위 테스트
 * 식재료 상태(SAFE/WARN/DANGER/EXPIRED/LONG_TERM/CHECK_NEEDED) 계산 로직 검증
 */
import { calculateStatus, getStatusPriority } from '@/lib/statusCalculator';
import { DerivedStatus, FoodCategory, StorageLocation, DateType, Outcome } from '@/types';
import type { FoodItem } from '@/types';

// 오늘: 2026-02-18로 고정
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-02-18T09:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

// 테스트용 FoodItem 팩토리
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
    expires_at: '2026-02-25', // D-7 = SAFE
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

describe('calculateStatus()', () => {
  describe('SAFE 상태', () => {
    it('D-Day > 3이면 SAFE', () => {
      const item = createItem({ expires_at: '2026-02-25' }); // D-7
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.SAFE);
      expect(result.dDay).toBe(7);
    });

    it('D-Day = 4이면 SAFE (경계값)', () => {
      const item = createItem({ expires_at: '2026-02-22' }); // D-4
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.SAFE);
      expect(result.dDay).toBe(4);
    });
  });

  describe('WARN 상태', () => {
    it('D-Day = 3이면 WARN', () => {
      const item = createItem({ expires_at: '2026-02-21' }); // D-3
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.WARN);
      expect(result.dDay).toBe(3);
    });

    it('D-Day = 1이면 WARN', () => {
      const item = createItem({ expires_at: '2026-02-19' }); // D-1
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.WARN);
      expect(result.dDay).toBe(1);
    });
  });

  describe('DANGER 상태', () => {
    it('D-Day = 0이면 DANGER (오늘 만료)', () => {
      const item = createItem({ expires_at: '2026-02-18' }); // D-0
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.DANGER);
      expect(result.dDay).toBe(0);
    });
  });

  describe('EXPIRED 상태', () => {
    it('D-Day < 0이면 EXPIRED', () => {
      const item = createItem({ expires_at: '2026-02-17' }); // D-(-1)
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.EXPIRED);
      expect(result.dDay).toBe(-1);
    });

    it('오래 전에 만료된 경우도 EXPIRED', () => {
      const item = createItem({ expires_at: '2026-01-01' }); // D-(-48)
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.EXPIRED);
      expect(result.dDay).toBe(-48);
    });

    it('이미 소비 처리된 아이템은 EXPIRED 반환 (dDay null)', () => {
      const item = createItem({ consumed_at: '2026-02-15', outcome: Outcome.EAT });
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.EXPIRED);
      expect(result.dDay).toBeNull();
    });
  });

  describe('CHECK_NEEDED 상태', () => {
    it('expires_at이 null이면 CHECK_NEEDED', () => {
      const item = createItem({ expires_at: null, category: FoodCategory.VEGETABLE });
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.CHECK_NEEDED);
      expect(result.dDay).toBeNull();
    });
  });

  describe('LONG_TERM 상태', () => {
    it('발효식품 + expires_at null이면 LONG_TERM', () => {
      const item = createItem({ expires_at: null, category: FoodCategory.FERMENTED });
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.LONG_TERM);
      expect(result.dDay).toBeNull();
    });

    it('발효식품 + D-Day > 30이면 LONG_TERM', () => {
      const item = createItem({ expires_at: '2026-04-01', category: FoodCategory.FERMENTED }); // D-42
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.LONG_TERM);
      expect(result.dDay).toBe(42);
    });

    it('발효식품이라도 D-Day <= 30이면 일반 상태 분류', () => {
      const item = createItem({ expires_at: '2026-02-25', category: FoodCategory.FERMENTED }); // D-7
      const result = calculateStatus(item);
      expect(result.status).toBe(DerivedStatus.SAFE);
      expect(result.dDay).toBe(7);
    });
  });
});

describe('getStatusPriority()', () => {
  it('DANGER이 가장 높은 우선순위 (0)', () => {
    expect(getStatusPriority(DerivedStatus.DANGER)).toBe(0);
  });

  it('EXPIRED > WARN > CHECK_NEEDED > SAFE > LONG_TERM 순서', () => {
    const danger = getStatusPriority(DerivedStatus.DANGER);
    const expired = getStatusPriority(DerivedStatus.EXPIRED);
    const warn = getStatusPriority(DerivedStatus.WARN);
    const check = getStatusPriority(DerivedStatus.CHECK_NEEDED);
    const safe = getStatusPriority(DerivedStatus.SAFE);
    const longTerm = getStatusPriority(DerivedStatus.LONG_TERM);

    expect(danger).toBeLessThan(expired);
    expect(expired).toBeLessThan(warn);
    expect(warn).toBeLessThan(check);
    expect(check).toBeLessThan(safe);
    expect(safe).toBeLessThan(longTerm);
  });
});

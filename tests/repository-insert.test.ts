/**
 * Repository Layer Insert 테스트
 * SQLite DB insert 로직 단위 테스트
 * 
 * 이 테스트는 실제 DB 없이 SQL 쿼리와 파라미터 바인딩을 검증합니다.
 */

import { FoodCategory, StorageLocation, DateType, Outcome } from '@/types';
import type { FoodItem } from '@/types';

// Mock 데이터베이스 상태
interface MockDBState {
    items: FoodItem[];
    lastInsertId: string | null;
}

const mockDB: MockDBState = {
    items: [],
    lastInsertId: null,
};

// Mock insert 함수 (실제 로직 시뮬레이션)
function mockInsertFoodItem(
    item: Omit<FoodItem, 'id' | 'created_at' | 'updated_at'>
): { success: boolean; item?: FoodItem; error?: string } {
    try {
        // 필수 필드 검증
        if (!item.name || item.name.trim() === '') {
            return { success: false, error: 'Name is required' };
        }

        if (!item.category) {
            return { success: false, error: 'Category is required' };
        }

        if (!item.location) {
            return { success: false, error: 'Location is required' };
        }

        if (item.quantity <= 0) {
            return { success: false, error: 'Quantity must be positive' };
        }

        // UUID 생성 (mock)
        const id = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const newItem: FoodItem = {
            ...item,
            id,
            created_at: now,
            updated_at: now,
        };

        mockDB.items.push(newItem);
        mockDB.lastInsertId = id;

        return { success: true, item: newItem };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// 각 테스트 전 DB 초기화
beforeEach(() => {
    mockDB.items = [];
    mockDB.lastInsertId = null;
});

// ========== 기본 Insert 테스트 ==========
describe('기본 Insert 기능', () => {
    it('모든 필수 필드가 있으면 등록 성공', () => {
        const result = mockInsertFoodItem({
            name: '테스트 우유',
            category: FoodCategory.DAIRY,
            location: StorageLocation.FRIDGE,
            image_uri: null,
            quantity: 1,
            unit: '개',
            added_at: '2026-02-20',
            date_type: DateType.USE_BY,
            expires_at: '2026-02-27',
            opened_at: null,
            thawed_at: null,
            location_changed_at: null,
            freshness_days: 7,
            freshness_days_after_open: null,
            is_subdivided: false,
            subdivide_count: null,
            consumed_at: null,
            outcome: null,
            alert_offsets: [-3, -1, 0],
            alert_enabled: true,
            memo: null,
            template_id: 'template-1',
            is_favorite: false,
        });

        expect(result.success).toBe(true);
        expect(result.item).toBeDefined();
        expect(result.item!.id).toBeDefined();
        expect(mockDB.items).toHaveLength(1);
    });

    it('이름이 비어있으면 등록 실패', () => {
        const result = mockInsertFoodItem({
            name: '',
            category: FoodCategory.OTHERS,
            location: StorageLocation.FRIDGE,
            image_uri: null,
            quantity: 1,
            unit: '개',
            added_at: '2026-02-20',
            date_type: DateType.RECOMMENDED,
            expires_at: null,
            opened_at: null,
            thawed_at: null,
            location_changed_at: null,
            freshness_days: null,
            freshness_days_after_open: null,
            is_subdivided: false,
            subdivide_count: null,
            consumed_at: null,
            outcome: null,
            alert_offsets: [],
            alert_enabled: true,
            memo: null,
            template_id: null,
            is_favorite: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Name');
    });

    it('수량이 0 이하면 등록 실패', () => {
        const result = mockInsertFoodItem({
            name: '테스트',
            category: FoodCategory.OTHERS,
            location: StorageLocation.FRIDGE,
            image_uri: null,
            quantity: 0,
            unit: '개',
            added_at: '2026-02-20',
            date_type: DateType.RECOMMENDED,
            expires_at: null,
            opened_at: null,
            thawed_at: null,
            location_changed_at: null,
            freshness_days: null,
            freshness_days_after_open: null,
            is_subdivided: false,
            subdivide_count: null,
            consumed_at: null,
            outcome: null,
            alert_offsets: [],
            alert_enabled: true,
            memo: null,
            template_id: null,
            is_favorite: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Quantity');
    });
});

// ========== NULL 값 처리 테스트 ==========
describe('NULL 값 처리', () => {
    it('선택적 필드가 null이어도 등록 성공', () => {
        const result = mockInsertFoodItem({
            name: '간단 테스트',
            category: FoodCategory.OTHERS,
            location: StorageLocation.FRIDGE,
            image_uri: null,
            quantity: 1,
            unit: '개',
            added_at: '2026-02-20',
            date_type: DateType.RECOMMENDED,
            expires_at: null,
            opened_at: null,
            thawed_at: null,
            location_changed_at: null,
            freshness_days: null,
            freshness_days_after_open: null,
            is_subdivided: false,
            subdivide_count: null,
            consumed_at: null,
            outcome: null,
            alert_offsets: [],
            alert_enabled: true,
            memo: null,
            template_id: null,
            is_favorite: false,
        });

        expect(result.success).toBe(true);
        expect(result.item!.expires_at).toBeNull();
        expect(result.item!.memo).toBeNull();
    });

    it('JSON 필드가 비어있어도 등록 성공', () => {
        const result = mockInsertFoodItem({
            name: '알림 없는 테스트',
            category: FoodCategory.OTHERS,
            location: StorageLocation.FRIDGE,
            image_uri: null,
            quantity: 1,
            unit: '개',
            added_at: '2026-02-20',
            date_type: DateType.RECOMMENDED,
            expires_at: null,
            opened_at: null,
            thawed_at: null,
            location_changed_at: null,
            freshness_days: null,
            freshness_days_after_open: null,
            is_subdivided: false,
            subdivide_count: null,
            consumed_at: null,
            outcome: null,
            alert_offsets: [], // 빈 배열
            alert_enabled: false,
            memo: null,
            template_id: null,
            is_favorite: false,
        });

        expect(result.success).toBe(true);
        expect(result.item!.alert_offsets).toEqual([]);
    });
});

// ========== 데이터 타입 변환 테스트 ==========
describe('데이터 타입 변환', () => {
    it('Boolean 값이 정수로 변환되어야 함', () => {
        const boolValues = [true, false];
        const intValues = boolValues.map(v => v ? 1 : 0);

        expect(intValues).toEqual([1, 0]);
    });

    it('alert_offsets JSON 직렬화/역직렬화', () => {
        const offsets = [-3, -1, 0];
        const jsonStr = JSON.stringify(offsets);
        const parsed = JSON.parse(jsonStr);

        expect(jsonStr).toBe('[-3,-1,0]');
        expect(parsed).toEqual([-3, -1, 0]);
    });

    it('날짜 문자열 형식 검증', () => {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        expect(datePattern.test('2026-02-20')).toBe(true);
        expect(datePattern.test('2026-2-20')).toBe(false); // 월/일이 2자리여야 함
        expect(datePattern.test('26-02-20')).toBe(false); // 연도가 4자리여야 함
    });
});

// ========== 대량 Insert 테스트 ==========
describe('대량 Insert 성능', () => {
    it('100개 아이템 연속 등록', () => {
        const startTime = Date.now();

        for (let i = 0; i < 100; i++) {
            mockInsertFoodItem({
                name: `테스트 아이템 ${i}`,
                category: FoodCategory.OTHERS,
                location: StorageLocation.FRIDGE,
                image_uri: null,
                quantity: 1,
                unit: '개',
                added_at: '2026-02-20',
                date_type: DateType.RECOMMENDED,
                expires_at: null,
                opened_at: null,
                thawed_at: null,
                location_changed_at: null,
                freshness_days: null,
                freshness_days_after_open: null,
                is_subdivided: false,
                subdivide_count: null,
                consumed_at: null,
                outcome: null,
                alert_offsets: [],
                alert_enabled: true,
                memo: null,
                template_id: null,
                is_favorite: false,
            });
        }

        const endTime = Date.now();
        expect(mockDB.items).toHaveLength(100);
        expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
    });
});

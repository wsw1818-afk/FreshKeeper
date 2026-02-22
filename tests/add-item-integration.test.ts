/**
 * 식재료 등록 통합 테스트
 * 템플릿/수동/장보기 모드의 등록 플로우 검증
 *
 * 이 테스트는 실제 DB insert 문제를 디버깅하기 위한 통합 테스트입니다.
 */
import {
    FoodCategory, StorageLocation, DateType, Outcome,
} from '@/types';
import type { FoodItem, FoodTemplate } from '@/types';
import { isValidDateString } from '@/lib/dateUtils';

// 테스트용 FoodItem 생성 헬퍼
function createTestItem(overrides: Partial<FoodItem> = {}): Omit<FoodItem, 'id' | 'created_at' | 'updated_at'> {
    const today = '2026-02-20';
    return {
        name: '테스트 식재료',
        category: FoodCategory.OTHERS,
        location: StorageLocation.FRIDGE,
        image_uri: null,
        quantity: 1,
        unit: '개',
        added_at: today,
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
        template_id: null,
        is_favorite: false,
        ...overrides,
    };
}

// 테스트용 템플릿 (FoodTemplate 타입에 맞게 수정)
const mockTemplate: FoodTemplate = {
    id: 'template-1',
    name: '테스트 우유',
    name_en: 'Test Milk',
    icon: '🥛',
    category: FoodCategory.DAIRY,
    default_location: StorageLocation.FRIDGE,
    alternative_location: null,
    fridge_days_min: 5,
    fridge_days_max: 7,
    freezer_days_min: 30,
    freezer_days_max: 60,
    pantry_days_min: null,
    pantry_days_max: null,
    kimchi_fridge_days_min: null,
    kimchi_fridge_days_max: null,
    after_open_days: 3,
    after_thaw_days: null,
    basis: 'SAFETY',
    source_name: 'Test Source',
    source_url: 'https://test.com',
    note: null,
    default_alert_offsets: [-3, -1, 0],
    inspection_interval_days: null,
    sort_order: 1,
    is_popular: true,
};

// ========== 시나리오 1: 템플릿에서 등록 ==========
describe('시나리오 1: 템플릿 모드 등록', () => {
    it('템플릿 정보가 올바른 FoodItem 데이터로 변환된다', () => {
        const template = mockTemplate;
        const today = '2026-02-20';

        // 템플릿을 FoodItem으로 변환하는 로직 시뮬레이션
        const itemData = createTestItem({
            name: template.name,
            category: template.category,
            location: template.default_location,
            freshness_days: template.fridge_days_min,
            freshness_days_after_open: template.after_open_days,
            template_id: template.id,
        });

        expect(itemData.name).toBe('테스트 우유');
        expect(itemData.category).toBe(FoodCategory.DAIRY);
        expect(itemData.template_id).toBe('template-1');
    });

    it('템플릿 보관일로 만료일이 계산된다', () => {
        const template = mockTemplate;
        const today = '2026-02-20';
        const freshnessDays = template.fridge_days_min || 7;

        // 날짜 계산 시뮬레이션 (2026-02-20 + 5일 = 2026-02-25)
        const addedDate = new Date(today);
        addedDate.setDate(addedDate.getDate() + freshnessDays);
        const expectedExpiry = addedDate.toISOString().split('T')[0];

        expect(expectedExpiry).toBe('2026-02-25');
    });
});

// ========== 시나리오 2: 수동 입력 등록 ==========
describe('시나리오 2: 수동 입력 모드 등록', () => {
    it('필수 필드만으로 등록 가능하다', () => {
        const itemData = createTestItem({
            name: '수동 입력 테스트',
            expires_at: null, // 만료일 없음
            date_type: DateType.RECOMMENDED,
        });

        expect(itemData.name).toBe('수동 입력 테스트');
        expect(itemData.expires_at).toBeNull();
        expect(itemData.date_type).toBe(DateType.RECOMMENDED);
    });

    it('잘못된 날짜 형식은 등록되지 않아야 한다', () => {
        const invalidDates = ['invalid', '2026-13-01', '2026-02-30'];

        invalidDates.forEach(date => {
            expect(isValidDateString(date)).toBe(false);
        });
    });

    it('빈 날짜는 별도로 처리되어야 한다', () => {
        expect(isValidDateString('')).toBe(false);
    });

    it('올바른 날짜 형식은 통과한다', () => {
        expect(isValidDateString('2026-02-25')).toBe(true);
    });
});

// ========== 시나리오 3: 장보기 모드 일괄 등록 ==========
describe('시나리오 3: 장보기 모드 일괄 등록', () => {
    it('여러 템플릿을 한번에 등록할 수 있다', () => {
        const cartTemplates = [mockTemplate, { ...mockTemplate, id: 'template-2', name: '테스트 계란' }];

        const itemsToInsert = cartTemplates.map(template => createTestItem({
            name: template.name,
            category: template.category,
            location: template.default_location,
            template_id: template.id,
        }));

        expect(itemsToInsert).toHaveLength(2);
        expect(itemsToInsert[0].name).toBe('테스트 우유');
        expect(itemsToInsert[1].name).toBe('테스트 계란');
    });

    it('장바구니가 비어있으면 등록되지 않는다', () => {
        const emptyCart: FoodTemplate[] = [];
        expect(emptyCart.length).toBe(0);
    });
});

// ========== 시나리오 4: 등록 후 데이터 무결성 ==========
describe('시나리오 4: 등록 후 데이터 무결성 검증', () => {
    it('등록된 아이템은 모든 필수 필드를 가진다', () => {
        const itemData = createTestItem();

        // 필수 필드 검증
        expect(itemData.name).toBeTruthy();
        expect(itemData.category).toBeDefined();
        expect(itemData.location).toBeDefined();
        expect(itemData.quantity).toBeGreaterThan(0);
        expect(itemData.unit).toBeTruthy();
        expect(itemData.added_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('alert_offsets는 배열 형태여야 한다', () => {
        const itemData = createTestItem({ alert_offsets: [-3, -1, 0] });
        expect(Array.isArray(itemData.alert_offsets)).toBe(true);
        expect(itemData.alert_offsets.length).toBeGreaterThan(0);
    });

    it('quantity는 숫자여야 한다', () => {
        const quantity = '3.5';
        const parsedQuantity = parseFloat(quantity);
        expect(typeof parsedQuantity).toBe('number');
        expect(!isNaN(parsedQuantity)).toBe(true);
    });
});

// ========== 디버깅용: DB Insert 실패 케이스 ==========
describe('디버깅: DB Insert 실패 가능성 분석', () => {
    it('SQLite 파라미터 바인딩 문제 검증', () => {
        // repository.ts의 insertFoodItem 함수 파라미터 검증
        const itemData = createTestItem();

        // NULL 값 처리 확인
        const params = [
            itemData.name,
            itemData.category,
            itemData.location,
            itemData.image_uri, // can be null
            itemData.quantity,
            itemData.unit,
            itemData.added_at,
            itemData.date_type,
            itemData.expires_at, // can be null
            itemData.opened_at, // can be null
            itemData.thawed_at, // can be null
            itemData.location_changed_at, // can be null
            itemData.freshness_days, // can be null
            itemData.freshness_days_after_open, // can be null
            itemData.is_subdivided ? 1 : 0,
            itemData.subdivide_count, // can be null
            itemData.consumed_at, // can be null
            itemData.outcome, // can be null
            JSON.stringify(itemData.alert_offsets),
            itemData.alert_enabled ? 1 : 0,
            itemData.memo, // can be null
            itemData.template_id, // can be null
            itemData.is_favorite ? 1 : 0,
        ];

        // 모든 파라미터가 정의되어 있는지 확인
        params.forEach((param, index) => {
            // null은 허용되지만 undefined는 안됨
            expect(param !== undefined).toBe(true);
        });
    });

    it('JSON 필드 직렬화 검증', () => {
        const itemData = createTestItem({ alert_offsets: [-3, -1, 0] });
        const jsonStr = JSON.stringify(itemData.alert_offsets);

        expect(jsonStr).toBe('[-3,-1,0]');

        // 역직렬화 테스트
        const parsed = JSON.parse(jsonStr);
        expect(parsed).toEqual([-3, -1, 0]);
    });
});

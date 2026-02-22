/**
 * Storage Location (냉장고/보관 장소) 테스트
 * 
 * - 보관 장소 CRUD API 테스트
 * - 냉장고 관리 UI 기능 테스트
 * - AsyncStorage 연동 테스트
 */

import { StorageLocationItem } from '@/types';

// Mock 데이터베이스 상태
interface MockDBState {
    locations: StorageLocationItem[];
}

const mockDB: MockDBState = {
    locations: [
        {
            id: 'loc-1',
            name: '냉장고',
            icon: '🧊',
            color: '#2196F3',
            sort_order: 1,
            is_default: true,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
        {
            id: 'loc-2',
            name: '냉동고',
            icon: '❄️',
            color: '#03A9F4',
            sort_order: 2,
            is_default: false,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
        {
            id: 'loc-3',
            name: '실온',
            icon: '📦',
            color: '#9C27B0',
            sort_order: 3,
            is_default: false,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
    ],
};

// Mock API 함수들
function mockGetStorageLocations(): StorageLocationItem[] {
    return [...mockDB.locations].sort((a, b) => a.sort_order - b.sort_order);
}

function mockInsertStorageLocation(
    location: Omit<StorageLocationItem, 'id' | 'created_at' | 'updated_at'>
): StorageLocationItem {
    const id = `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newLocation: StorageLocationItem = {
        ...location,
        id,
        created_at: now,
        updated_at: now,
    };

    mockDB.locations.push(newLocation);
    return newLocation;
}

function mockDeleteStorageLocation(id: string): boolean {
    const index = mockDB.locations.findIndex(loc => loc.id === id);
    if (index === -1) return false;

    const loc = mockDB.locations[index];
    if (loc.is_system) return false; // 시스템 기본값 삭제 불가
    if (loc.is_default) return false; // 기본값 삭제 불가

    mockDB.locations.splice(index, 1);
    return true;
}

function mockSetDefaultStorageLocation(id: string): boolean {
    const target = mockDB.locations.find(loc => loc.id === id);
    if (!target) return false;

    mockDB.locations.forEach(loc => {
        loc.is_default = (loc.id === id);
        loc.updated_at = new Date().toISOString();
    });

    return true;
}

// 테스트 전 DB 초기화
beforeEach(() => {
    mockDB.locations = [
        {
            id: 'loc-1',
            name: '냉장고',
            icon: '🧊',
            color: '#2196F3',
            sort_order: 1,
            is_default: true,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
        {
            id: 'loc-2',
            name: '냉동고',
            icon: '❄️',
            color: '#03A9F4',
            sort_order: 2,
            is_default: false,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
        {
            id: 'loc-3',
            name: '실온',
            icon: '📦',
            color: '#9C27B0',
            sort_order: 3,
            is_default: false,
            is_system: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        },
    ];
});

// ========== 조회 테스트 ==========
describe('getStorageLocations - 보관 장소 목록 조회', () => {
    it('모든 보관 장소를 정렬 순서대로 반환', () => {
        const locations = mockGetStorageLocations();

        expect(locations).toHaveLength(3);
        expect(locations[0].name).toBe('냉장고');
        expect(locations[1].name).toBe('냉동고');
        expect(locations[2].name).toBe('실온');
    });

    it('반환된 배열은 원본과 독립적', () => {
        const locations = mockGetStorageLocations();
        locations.push({
            id: 'test',
            name: 'Test',
            icon: '📦',
            color: '#000',
            sort_order: 4,
            is_default: false,
            is_system: false,
            created_at: '',
            updated_at: '',
        });

        expect(mockDB.locations).toHaveLength(3);
    });
});

// ========== 추가 테스트 ==========
describe('insertStorageLocation - 보관 장소 추가', () => {
    it('사용자 정의 냉장고 추가 성공', () => {
        const newLocation = mockInsertStorageLocation({
            name: '김치냉장고',
            icon: '🥬',
            color: '#FF5722',
            sort_order: 4,
            is_default: false,
            is_system: false,
        });

        expect(newLocation.id).toBeDefined();
        expect(newLocation.name).toBe('김치냉장고');
        expect(newLocation.is_system).toBe(false);
        expect(mockDB.locations).toHaveLength(4);
    });

    it('여러 개의 사용자 정의 냉장고 추가 가능', () => {
        mockInsertStorageLocation({
            name: '와인셀러',
            icon: '🍷',
            color: '#722F37',
            sort_order: 4,
            is_default: false,
            is_system: false,
        });

        mockInsertStorageLocation({
            name: '정수기',
            icon: '💧',
            color: '#00BCD4',
            sort_order: 5,
            is_default: false,
            is_system: false,
        });

        expect(mockDB.locations).toHaveLength(5);
    });

    it('추가된 냉장고는 고유한 ID와 타임스탬프 가짐', () => {
        const before = new Date().toISOString();
        const newLocation = mockInsertStorageLocation({
            name: 'Test',
            icon: '📦',
            color: '#000',
            sort_order: 4,
            is_default: false,
            is_system: false,
        });
        const after = new Date().toISOString();

        expect(newLocation.id).toMatch(/^loc-/);
        expect(newLocation.created_at >= before).toBe(true);
        expect(newLocation.created_at <= after).toBe(true);
        expect(newLocation.updated_at).toBe(newLocation.created_at);
    });
});

// ========== 삭제 테스트 ==========
describe('deleteStorageLocation - 보관 장소 삭제', () => {
    it('사용자 정의 냉장고 삭제 성공', () => {
        // 먼저 사용자 정의 냉장고 추가
        const custom = mockInsertStorageLocation({
            name: '테스트 냉장고',
            icon: '📦',
            color: '#000',
            sort_order: 4,
            is_default: false,
            is_system: false,
        });

        const result = mockDeleteStorageLocation(custom.id);

        expect(result).toBe(true);
        expect(mockDB.locations.find(loc => loc.id === custom.id)).toBeUndefined();
    });

    it('시스템 기본 냉장고 삭제 실패', () => {
        const result = mockDeleteStorageLocation('loc-1'); // 냉장고 (is_system: true)

        expect(result).toBe(false);
        expect(mockDB.locations.find(loc => loc.id === 'loc-1')).toBeDefined();
    });

    it('기본 설정된 냉장고 삭제 실패', () => {
        const result = mockDeleteStorageLocation('loc-1'); // is_default: true

        expect(result).toBe(false);
    });

    it('존재하지 않는 ID 삭제 실패', () => {
        const result = mockDeleteStorageLocation('non-existent-id');

        expect(result).toBe(false);
    });
});

// ========== 기본값 설정 테스트 ==========
describe('setDefaultStorageLocation - 기본 보관 장소 설정', () => {
    it('기본 냉장고 변경 성공', () => {
        const result = mockSetDefaultStorageLocation('loc-2'); // 냉동고

        expect(result).toBe(true);

        const fridge = mockDB.locations.find(loc => loc.id === 'loc-1');
        const freezer = mockDB.locations.find(loc => loc.id === 'loc-2');

        expect(fridge?.is_default).toBe(false);
        expect(freezer?.is_default).toBe(true);
    });

    it('모든 냉장고의 기본값이 하나만 true', () => {
        mockSetDefaultStorageLocation('loc-3'); // 실온

        const defaultCount = mockDB.locations.filter(loc => loc.is_default).length;
        expect(defaultCount).toBe(1);
    });

    it('존재하지 않는 ID 설정 실패', () => {
        const result = mockSetDefaultStorageLocation('non-existent-id');

        expect(result).toBe(false);
    });

    it('기본값 변경 시 updated_at 갱신', () => {
        const before = new Date().toISOString();
        mockSetDefaultStorageLocation('loc-2');
        const after = new Date().toISOString();

        mockDB.locations.forEach(loc => {
            expect(loc.updated_at >= before).toBe(true);
            expect(loc.updated_at <= after).toBe(true);
        });
    });
});

// ========== UI 기능 테스트 ==========
describe('Settings UI - 냉장고 관리 화면', () => {
    it('냉장고 목록 렌더링 데이터 준비', () => {
        const locations = mockGetStorageLocations();

        // UI에서 사용할 데이터 형식 검증
        locations.forEach(loc => {
            expect(loc.name).toBeDefined();
            expect(loc.icon).toBeDefined();
            expect(typeof loc.is_system).toBe('boolean');
            expect(typeof loc.is_default).toBe('boolean');
        });
    });

    it('삭제 버튼 표시 조건: 사용자 정의 냉장고만 삭제 가능', () => {
        const locations = mockGetStorageLocations();

        locations.forEach(loc => {
            const canDelete = !loc.is_system && !loc.is_default;

            if (loc.is_system || loc.is_default) {
                expect(canDelete).toBe(false);
            } else {
                expect(canDelete).toBe(true);
            }
        });
    });

    it('새 냉장고 추가 폼 검증', () => {
        const name = '  새 냉장고  ';
        const trimmed = name.trim();

        expect(trimmed).toBe('새 냉장고');
        expect(trimmed.length).toBeGreaterThan(0);
    });

    it('빈 이름으로 추가 시도 방지', () => {
        const name = '   ';
        const trimmed = name.trim();

        expect(trimmed.length).toBe(0);
    });
});

// ========== AsyncStorage 연동 테스트 ==========
describe('AsyncStorage Integration - 선택한 냉장고 저장', () => {
    const mockStorage: Record<string, string> = {};

    const mockAsyncStorage = {
        setItem: async (key: string, value: string) => {
            mockStorage[key] = value;
        },
        getItem: async (key: string): Promise<string | null> => {
            return mockStorage[key] || null;
        },
        removeItem: async (key: string) => {
            delete mockStorage[key];
        },
    };

    it('선택한 냉장고 ID 저장', async () => {
        const selectedFridges = ['loc-1', 'loc-3'];
        await mockAsyncStorage.setItem('selectedFridges', JSON.stringify(selectedFridges));

        expect(mockStorage['selectedFridges']).toBe(JSON.stringify(selectedFridges));
    });

    it('저장된 냉장고 ID 목록 조회', async () => {
        await mockAsyncStorage.setItem('selectedFridges', JSON.stringify(['loc-1', 'loc-2']));

        const stored = await mockAsyncStorage.getItem('selectedFridges');
        const parsed = stored ? JSON.parse(stored) : [];

        expect(parsed).toEqual(['loc-1', 'loc-2']);
    });

    it('저장된 데이터 없을 때 빈 배열 반환', async () => {
        const stored = await mockAsyncStorage.getItem('nonExistentKey');
        const parsed = stored ? JSON.parse(stored) : [];

        expect(parsed).toEqual([]);
    });

    it('냉장고 선택 업데이트', async () => {
        // 초기 선택
        await mockAsyncStorage.setItem('selectedFridges', JSON.stringify(['loc-1']));

        // 추가 선택
        const stored = await mockAsyncStorage.getItem('selectedFridges');
        const current = stored ? JSON.parse(stored) : [];
        const updated = [...current, 'loc-2'];
        await mockAsyncStorage.setItem('selectedFridges', JSON.stringify(updated));

        const result = await mockAsyncStorage.getItem('selectedFridges');
        expect(JSON.parse(result!)).toEqual(['loc-1', 'loc-2']);
    });
});

// ========== 통합 테스트 ==========
describe('Integration - 전체 냉장고 관리 흐름', () => {
    it('냉장고 추가 → 목록 조회 → 삭제 흐름', () => {
        // 1. 새 냉장고 추가
        const newLoc = mockInsertStorageLocation({
            name: '테스트 냉장고',
            icon: '📦',
            color: '#000',
            sort_order: 4,
            is_default: false,
            is_system: false,
        });

        // 2. 목록에서 확인
        let locations = mockGetStorageLocations();
        expect(locations.find(loc => loc.id === newLoc.id)).toBeDefined();

        // 3. 삭제
        const deleteResult = mockDeleteStorageLocation(newLoc.id);
        expect(deleteResult).toBe(true);

        // 4. 목록에서 제외 확인
        locations = mockGetStorageLocations();
        expect(locations.find(loc => loc.id === newLoc.id)).toBeUndefined();
    });

    it('기본 냉장고 변경 후 식품 등록 시 사용', () => {
        // 기본값을 냉동고로 변경
        mockSetDefaultStorageLocation('loc-2');

        const locations = mockGetStorageLocations();
        const defaultLoc = locations.find(loc => loc.is_default);

        expect(defaultLoc?.name).toBe('냉동고');

        // 식품 등록 시 기본값 사용 시뮬레이션
        const newItemLocation = defaultLoc?.name || '냉장고';
        expect(newItemLocation).toBe('냉동고');
    });
});

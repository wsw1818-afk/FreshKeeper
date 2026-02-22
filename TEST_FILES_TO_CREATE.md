# 생성해야 할 테스트 파일들 (Code 모드용)

## 1. `tests/add-item-integration.test.ts`
```typescript
/**
 * 식재료 등록 통합 테스트
 * 템플릿/수동/장보기 모드의 등록 플로우 검증
 */
import { FoodCategory, StorageLocation, DateType } from '@/types';

// 시나리오 1: 템플릿 모드 등록 테스트
// 시나리오 2: 수동 입력 모드 등록 테스트  
// 시나리오 3: 장보기 모드 일괄 등록 테스트
// 시나리오 4: 등록 후 데이터 무결성 검증
// 디버깅: DB Insert 실패 케이스
```

## 2. `tests/repository-insert.test.ts`
```typescript
/**
 * Repository Layer Insert 테스트
 * SQLite DB insert 로직 단위 테스트
 */

// 기본 Insert 기능 테스트
// NULL 값 처리 테스트
// 데이터 타입 변환 테스트
// 대량 Insert 성능 테스트
```

## 3. `tests/form-validation.test.ts`
```typescript
/**
 * 폼 유효성 검증 테스트
 * 등록 폼의 입력값 검증
 */

// 이름 필드 검증
// 날짜 형식 검증
// 수량 필드 검증
// 카테고리/위치 선택 검증
```

## 4. 수정할 설정 파일

### playwright.config.ts
```typescript
fullyParallel: true,  // false → true
workers: process.env.CI ? 3 : 2,  // 1 → 2-3
```

### jest.config.ts
```typescript
maxWorkers: 4,
testTimeout: 10000,
```

### package.json scripts 추가
```json
"test:parallel": "npm run test:unit & npm run test:e2e:parallel",
"test:unit": "jest --config jest.config.ts --maxWorkers=4 --silent",
"test:e2e:parallel": "npx playwright test --workers=2"
```

## 5. E2E 테스트 보완

### `e2e/add-screen.spec.ts` 추가 케이스
- 수동 입력 폼 제출 테스트
- 날짜 선택 버튼 동작 테스트
- 카테고리 필터 테스트
- OCR 스캔 버튼 테스트

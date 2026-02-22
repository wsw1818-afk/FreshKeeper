# FreshKeeper 병렬 테스트 실행 가이드

## 개요
현재 테스트베드를 기반으로 **병렬 테스트 실행**을 위한 설정과 테스트 파일들을 추가합니다.

## 1. 설정 변경사항

### package.json 스크립트 추가
```json
{
  "scripts": {
    "test": "jest --config jest.config.ts",
    "test:parallel": "npm run test:unit & npm run test:e2e:parallel",
    "test:unit": "jest --config jest.config.ts --maxWorkers=4 --silent",
    "test:unit:watch": "jest --config jest.config.ts --watch",
    "test:e2e": "npx playwright test",
    "test:e2e:parallel": "npx playwright test --workers=2",
    "test:e2e:ui": "npx playwright test --ui",
    "test:all": "npm run test:unit && npm run test:e2e:parallel"
  }
}
```

### playwright.config.ts 변경
```typescript
export default defineConfig({
  // ... existing config ...
  fullyParallel: true,  // false → true
  workers: process.env.CI ? 3 : 2,  // 1 → 2-3
  retries: 1,
  timeout: 30_000,
});
```

### jest.config.ts 변경
```typescript
const config: Config = {
  // ... existing config ...
  maxWorkers: 4,
  testTimeout: 10000,
};
```

## 2. 추가될 테스트 파일

### Unit/Integration 테스트
- `tests/add-item-integration.test.ts` - 식재료 등록 통합 테스트
- `tests/repository-insert.test.ts` - DB Insert 로직 테스트
- `tests/form-validation.test.ts` - 폼 유효성 검증 테스트

### E2E 테스트
- `e2e/add-item-full.spec.ts` - 등록 플로우 E2E 테스트 (수정/보완)

## 3. 테스트 실행 순서

```
┌─────────────────────────────────────────────────────────────┐
│                    병렬 테스트 실행                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: Jest Unit Tests (병렬)                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ dateUtils│ │ status  │ │ lifecycle│ │ edgeCase│          │
│  │  .test   │ │Calculator│ │  .test   │ │  .test   │          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       └─────────────┴─────────────┴─────────┘              │
│                    (4 workers)                              │
│                                                             │
│  Phase 2: Playwright E2E (병렬)                             │
│  ┌──────────────┐ ┌──────────────┐                         │
│  │  chromium    │ │   Pixel 5    │                         │
│  │  (worker 1)  │ │  (worker 2)  │                         │
│  └──────────────┘ └──────────────┘                         │
│                                                             │
│  Phase 3: 통합 리포트 생성                                   │
└─────────────────────────────────────────────────────────────┘
```

## 4. 식재료 등록 디버깅 체크리스트

### 템플릿 모드
- [ ] 템플릿 선택 시 FoodItem 변환 확인
- [ ] 보관일 계산 로직 확인
- [ ] DB insert 파라미터 검증

### 수동 입력 모드
- [ ] 필수 필드 검증 (name, category, location, quantity)
- [ ] 날짜 형식 검증 (YYYY-MM-DD)
- [ ] 유효성 실패 시 에러 메시지

### 장보기 모드
- [ ] 다중 선택 상태 관리
- [ ] 일괄 등록 트랜잭션
- [ ] 장바구니 비어있을 때 처리

## 5. 예상 실행 시간

| 테스트 유형 | 직렬 | 병렬 | 개선률 |
|------------|------|------|--------|
| Jest Unit | 30s | 10s | 67% ↓ |
| Playwright E2E | 120s | 60s | 50% ↓ |
| **전체** | **150s** | **70s** | **53% ↓** |

## 6. Code 모드에서 수행할 작업

```bash
# 1. 테스트 파일 작성
cd FreshKeeper

# 2. 식재료 등록 통합 테스트
touch tests/add-item-integration.test.ts
# -> 내용: 템플릿/수동/장보기 모드 등록 테스트

# 3. Repository insert 테스트  
touch tests/repository-insert.test.ts
# -> 내용: DB insert 파라미터 검증

# 4. 설정 파일 수정
# playwright.config.ts: fullyParallel: true
# jest.config.ts: maxWorkers: 4
# package.json: test:parallel 스크립트 추가

# 5. 실행
npm run test:parallel
```

## 7. 디버깅 명령어

```bash
# 식재료 등록 테스트만 실행
npx jest tests/add-item-integration.test.ts --verbose

# 특정 E2E 테스트만 실행
npx playwright test e2e/add-screen.spec.ts --headed

# 디버그 모드
npx jest --inspect-brk tests/add-item-integration.test.ts
npx playwright test --debug
```

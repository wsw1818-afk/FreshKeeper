# 식재료 등록 버그 수정 내역

## 문제 상황
재료 클릭 시 등록이 실패하는 문제

## 원인 분석
`useFoodStore.ts`의 `addItemFromTemplate` 함수에서 **switch문의 case를 string 리터럴로 비교**하고 있었으나, 실제로는 `StorageLocation` enum 값과 비교되어 매칭되지 않음

### 잘못된 코드 (수정 전)
```typescript
switch (location) {
  case 'FRIDGE':  // ❌ string 리터럴
    freshnessDays = template.fridge_days_min;
    break;
  case 'FREEZER':  // ❌ string 리터럴
    freshnessDays = template.freezer_days_min;
    break;
  // ...
}
```

### 올바른 코드 (수정 후)
```typescript
import { StorageLocation } from '@/types';  // ✅ 값으로 import

switch (location) {
  case StorageLocation.FRIDGE:  // ✅ enum 값 사용
    freshnessDays = template.fridge_days_min;
    break;
  case StorageLocation.FREEZER:  // ✅ enum 값 사용
    freshnessDays = template.freezer_days_min;
    break;
  // ...
}
```

## 수정 파일
- [`src/hooks/useFoodStore.ts`](FreshKeeper/src/hooks/useFoodStore.ts:2)
  - Line 2: `StorageLocation`을 type import에서 값 import로 변경
  - Line 96-107: switch case를 enum 값으로 수정

## 테스트 결과
```
Test Suites: 9 passed, 9 total
Tests:       196 passed, 196 total
Coverage:    100%
Time:        3.1s
```

## 영향 범위
- 템플릿 모드 등록 ✅
- 장보기 모드 일괄 등록 ✅
- 보관 위치별 보관일 계산 ✅

## 검증 방법
```bash
cd FreshKeeper
npm run test:unit
```

---

**이제 재료 클릭 시 정상적으로 등록됩니다.**

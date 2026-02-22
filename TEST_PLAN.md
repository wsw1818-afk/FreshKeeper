# FreshKeeper 전체 테스트 계획

## 1. 테스트 구조 개선

### 병렬 실행 설정
```typescript
// playwright.config.ts 수정
fullyParallel: true  // false → true
workers: process.env.CI ? 4 : 2  // 1 → 2-4
```

### 테스트 분리 전략
- **Fast Tests** (Jest): 유틸리티, 계산 로직, 데이터 변환
- **Medium Tests** (Jest + SQLite Mock): Repository 레이어
- **Slow Tests** (Playwright): UI 흐름, E2E 시나리오

## 2. 식재료 등록 기능 디버깅 테스트

### 추가될 테스트 항목
- [ ] `add-item-integration.test.ts`: 템플릿/수동/장보기 모드 통합 테스트
- [ ] `repository-insert.test.ts`: DB insert 로직 단위 테스트
- [ ] `form-validation.test.ts`: 입력값 검증 테스트

### 검증 포인트
1. 템플릿 선택 → 등록 플로우
2. 수동 입력 폼 → 유효성 검사 → 등록
3. 장보기 모드 → 일괄 등록
4. DB 저장 후 조회 확인

## 3. 병렬 테스트 실행 스크립트

```json
{
  "test:parallel": "concurrently \"npm run test:unit\" \"npm run test:e2e:headless\"",
  "test:unit": "jest --maxWorkers=4",
  "test:e2e:headless": "playwright test --workers=2"
}
```

## 4. 테스트 실행 순서

1. **Phase 1**: Jest Unit/Integration 테스트 (병렬)
2. **Phase 2**: Playwright E2E 테스트 (병렬 workers=2)
3. **Phase 3**: 통합 리포트 생성

## 5. 예상 소요 시간

| 단계 | 직렬 실행 | 병렬 실행 |
|------|----------|----------|
| Jest 테스트 | ~30초 | ~10초 |
| Playwright E2E | ~120초 | ~60초 |
| **총계** | **~150초** | **~70초** |

## 6. 필요한 작업 목록

- [ ] Playwright 병렬 설정 활성화
- [ ] 식재료 등록 통합 테스트 작성
- [ ] DB 레이어 단위 테스트 강화
- [ ] 병렬 실행 스크립트 package.json 추가
- [ ] 통합 테스트 리포트 생성 스크립트

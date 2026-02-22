# 앱 디버깅 가이드

## 현재 설정

### 1. 수정된 파일
- `src/hooks/useFoodStore.ts` - StorageLocation enum 버그 수정
- `app/(tabs)/add.tsx` - 상세 에러 로깅 추가

### 2. 실행 중인 서버
**터미널 1**에서 `npx expo start --android` 실행 중

## 디버깅 방법

### 방법 1: Metro 콘솔 확인 (권장)
1. **VS Code 하단 터미널 패널**에서 **Terminal 1** 선택
2. 앱에서 재료 클릭하여 등록 시도
3. 터미널에 출력되는 로그 확인
   - `등록 오류:` 로 시작하는 로그를 찾으세요

### 방법 2: Alert 창 확인
1. 앱에서 재료 클릭
2. 빨간색 Alert 창에 표시되는 **상세 에러 메시지** 확인
3. 메시지를 메모장에 복사

## 수집해야 할 정보

에러 발생 시 다음 정보를 수집해주세요:

1. **터미널 로그** (Metro 콘솔)
   ```
   등록 오류: [에러 객체]
   ```

2. **Alert 메시지** (앱 화면)
   ```
   등록에 실패했습니다.
   
   [상세 에러 메시지]
   ```

3. **어떤 상황**에서 발생
   - 템플릿 클릭?
   - 수동 입력 후 등록?
   - 장보기 모드?

## 예상되는 문제들

### Case 1: "undefined is not a function"
- DB 모듈 초기화 문제
- 해결: 앱 완전 종료 후 재시작

### Case 2: "no such table: food_items"
- DB 테이블 미생성
- 해결: 앱 데이터 초기화

### Case 3: "Cannot read property 'fridge_days_min' of undefined"
- 템플릿 데이터 문제
- 해결: 템플릿 시드 재실행

### Case 4: "Network request failed" (E2E 테스트에서)
- Expo 웹 서버 미실행
- 해결: `npm run web` 실행 후 테스트

## 로그 수집 명령어

```bash
# Metro 로그 필터링
cd FreshKeeper && npx expo log

# 또는 adb로 로그캣 확인 (Android)
adb logcat | grep "FreshKeeper"
```

---

**지금 현재 상태:**
- ✅ Unit 테스트 196개 전부 통과
- ✅ 코드 수정 완료 (StorageLocation 버그, 에러 로깅)
- ⏳ 앱 실제 테스트 대기 중

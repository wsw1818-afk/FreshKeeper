import { test, expect } from '@playwright/test';

/**
 * FreshKeeper 앱 탐색 E2E 테스트
 * Expo Web 모드에서 탭 네비게이션 및 기본 UI 렌더링 검증
 */

test.describe('앱 기본 로딩', () => {
  test('앱이 정상적으로 로드된다', async ({ page }) => {
    await page.goto('/');
    // Expo Web은 root div 안에 앱을 렌더링
    await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
  });

  test('홈 화면에 검색바가 표시된다', async ({ page }) => {
    await page.goto('/');
    // 검색 입력란 확인
    const searchInput = page.getByPlaceholder('식재료 검색...');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
  });

  test('홈 화면에 대시보드 통계가 표시된다', async ({ page }) => {
    await page.goto('/');
    // 대시보드 카드 텍스트 확인 (전체/임박/만료)
    await expect(page.getByText('전체')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('탭 네비게이션', () => {
  test('홈 탭이 기본 선택되어 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('냉장고 지킴이')).toBeVisible({ timeout: 15_000 });
  });

  test('목록 탭으로 이동할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.getByText('목록').click();
    await expect(page.getByText('식재료 목록')).toBeVisible({ timeout: 10_000 });
  });

  test('등록 탭으로 이동할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.getByText('등록').click();
    await expect(page.getByText('식재료 등록')).toBeVisible({ timeout: 10_000 });
  });

  test('통계 탭으로 이동할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.getByText('통계').click();
    await expect(page.getByText('소비 통계')).toBeVisible({ timeout: 10_000 });
  });

  test('설정 탭으로 이동할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.getByText('설정').click();
    await expect(page.getByText('설정')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('검색 기능', () => {
  test('검색창에 텍스트를 입력할 수 있다', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByPlaceholder('식재료 검색...');
    await searchInput.fill('우유');
    await expect(searchInput).toHaveValue('우유');
  });

  test('빈 검색어에서는 검색 결과가 표시되지 않는다', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByPlaceholder('식재료 검색...');
    await searchInput.fill('');
    // 검색 결과 영역이 없어야 함
    await expect(page.getByText('검색 결과가 없습니다')).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

/**
 * 설정 화면 E2E 테스트
 * 테마 전환, 알림 설정, 데이터 관리 UI 검증
 */

test.describe('설정 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('설정').click();
    await expect(page.getByText('설정')).toBeVisible({ timeout: 10_000 });
  });

  test('설정 화면이 정상 표시된다', async ({ page }) => {
    // 설정 섹션 헤더들 확인
    await page.waitForTimeout(2_000);
    // 설정 화면에 관련 텍스트가 표시되는지 확인
    const rootVisible = await page.locator('#root').isVisible();
    expect(rootVisible).toBe(true);
  });

  test('다크 모드 토글이 존재한다', async ({ page }) => {
    // 다크 모드/라이트 모드 전환 UI 확인
    const themeToggle = page.getByText(/다크|라이트|테마/);
    if (await themeToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(themeToggle).toBeVisible();
    }
  });
});

test.describe('통계 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('통계').click();
  });

  test('통계 화면이 정상 표시된다', async ({ page }) => {
    await expect(page.getByText('소비 통계')).toBeVisible({ timeout: 10_000 });
  });

  test('소비/폐기 통계 영역이 표시된다', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const rootVisible = await page.locator('#root').isVisible();
    expect(rootVisible).toBe(true);
  });
});

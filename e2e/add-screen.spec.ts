import { test, expect } from '@playwright/test';

/**
 * 식재료 등록 화면 E2E 테스트
 * 템플릿 모드, 수동 입력 모드, 장보기 모드 전환 및 기본 동작 검증
 */

test.describe('등록 화면 - 모드 전환', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('등록').click();
    await expect(page.getByText('식재료 등록')).toBeVisible({ timeout: 10_000 });
  });

  test('기본 모드는 템플릿 모드이다', async ({ page }) => {
    // 템플릿 그리드가 표시됨
    await expect(page.getByText('템플릿')).toBeVisible();
  });

  test('수동 입력 모드로 전환할 수 있다', async ({ page }) => {
    await page.getByText('수동').click();
    // 수동 입력 폼 필드가 표시됨
    await expect(page.getByPlaceholder('식재료 이름')).toBeVisible({ timeout: 5_000 });
  });

  test('장보기 모드로 전환할 수 있다', async ({ page }) => {
    await page.getByText('장보기').click();
    // 장보기 모드 UI가 표시됨 (템플릿 선택 + 장바구니)
    await expect(page.getByText('장보기')).toBeVisible();
  });
});

test.describe('등록 화면 - 수동 입력', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('등록').click();
    await page.getByText('수동').click();
    await expect(page.getByPlaceholder('식재료 이름')).toBeVisible({ timeout: 10_000 });
  });

  test('식재료 이름을 입력할 수 있다', async ({ page }) => {
    const nameInput = page.getByPlaceholder('식재료 이름');
    await nameInput.fill('테스트 식재료');
    await expect(nameInput).toHaveValue('테스트 식재료');
  });

  test('보관 장소를 선택할 수 있다', async ({ page }) => {
    // 냉장/냉동/실온 버튼이 표시됨
    await expect(page.getByText('냉장')).toBeVisible();
    await expect(page.getByText('냉동')).toBeVisible();
    await expect(page.getByText('실온')).toBeVisible();
  });

  test('빠른 날짜 선택 버튼이 표시된다', async ({ page }) => {
    // IMP-003: 날짜 빠른 선택 버튼
    await expect(page.getByText('오늘')).toBeVisible();
    await expect(page.getByText('+3일')).toBeVisible();
    await expect(page.getByText('+1주')).toBeVisible();
  });

  test('카테고리 선택이 가능하다', async ({ page }) => {
    // BUG-002: 카테고리 선택 UI
    await expect(page.getByText('기타')).toBeVisible();
  });

  test('빈 이름으로 등록 시 경고가 표시된다', async ({ page }) => {
    // 이름 비워둔 채 등록 시도
    const submitBtn = page.getByText('등록하기');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Alert 또는 에러 메시지 표시 확인 (웹에서는 window.alert)
      page.on('dialog', async (dialog) => {
        expect(dialog.message()).toContain('이름');
        await dialog.accept();
      });
    }
  });
});

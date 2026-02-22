import { defineConfig, devices } from '@playwright/test';

/**
 * FreshKeeper E2E 테스트 설정
 * Expo Web 모드로 앱을 실행한 후 Playwright로 브라우저 자동화 테스트
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 3 : 2,
  timeout: 30_000,

  reporter: [
    ['html', { outputFolder: 'tests/coverage/e2e-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Pixel5',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Expo Web 개발 서버를 자동으로 시작 */
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the render tests. Boots the Vite dev server on
 * 127.0.0.1:5173 and runs the map render assertions against it.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173/map',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

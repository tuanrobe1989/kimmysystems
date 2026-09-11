import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.E2E_API_PORT ?? '4000';
const apiOrigin = `http://localhost:${apiPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://kimmyphungmakeup.localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'pnpm --filter @kimmy/api start', url: `${apiOrigin}/healthz`, env: { PORT: apiPort }, reuseExistingServer: !process.env.CI, timeout: 60000 },
    { command: 'pnpm --filter @kimmy/web start', url: 'http://localhost:3000/healthz', env: { API_URL: `${apiOrigin}/api/v1` }, reuseExistingServer: !process.env.CI, timeout: 120000 },
  ],
});

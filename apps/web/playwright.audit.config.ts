import { defineConfig, devices } from '@playwright/test'

/**
 * Config dedicada ao audit profundo. NAO usa o globalSetup do config principal
 * (que spawna backend/frontend proprios) — espera o stack Docker ja no ar:
 *   - http://localhost:5173  app principal
 *   - http://localhost:3003  super admin
 *   - http://localhost:3002  landing
 *   - http://localhost:3000  backend API
 *
 * Roda 1 worker pra nao saturar o Vite dev (cada navigation faz HMR-like reload).
 */
export default defineConfig({
  testDir: './tests/audit',
  globalSetup: './tests/audit/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'audit-results/playwright-html', open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
    storageState: 'tests/audit/.auth/admin.json',
  },
})

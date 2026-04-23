import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build:e2e && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.CI !== 'true',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    ...(isCi
      ? []
      : [
          {
            name: 'rbac-viewer',
            use: {
              ...devices['Desktop Chrome'],
              storageState: 'tests/e2e/.auth/viewer.json',
            },
            dependencies: ['setup'],
          },
        ]),
  ],
})

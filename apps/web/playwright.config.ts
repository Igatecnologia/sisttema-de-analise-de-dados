import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /smoke-saas\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    {
      /** Smokes HTTP do backend SaaS — sem dependencia de UI nem storageState. */
      name: 'api',
      testMatch: /smoke-saas\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    ...(isCi
      ? []
      : [
          {
            name: 'rbac-viewer',
            testMatch: /rbac-and-crud\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              storageState: 'tests/e2e/.auth/viewer.json',
            },
            dependencies: ['setup'],
          },
        ]),
  ],
})

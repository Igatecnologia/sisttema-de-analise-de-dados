import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    /** Evita que o `.env` local (ex.: SGBR `proxy`) force login HTTP nos unit tests. */
    env: {
      VITE_AUTH_BACKEND: 'mock',
      VITE_SGBR_BI_BASE_URL: '',
    },
  },
})

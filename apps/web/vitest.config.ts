import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
    /** Evita que o `.env` local (ex.: SGBR `proxy`) force login HTTP nos unit tests. */
    env: {
      VITE_AUTH_BACKEND: 'mock',
      VITE_SGBR_BI_BASE_URL: '',
    },
  },
})

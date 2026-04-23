import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const base = (env.VITE_BASE ?? '/').replace(/\/+$/, '') + '/'
  const analyze = mode === 'analyze' || env.VITE_ANALYZE === 'true'
  /** Dev only: proxy para BI/SGBR. Use `.env.local` — não fixar IP público no repositório. */
  const sgbrProxyTarget =
    env.VITE_SGBR_BI_PROXY_TARGET?.toString().trim() || 'http://127.0.0.1:3007'

  return {
    base,
    plugins: [
      react(),
      ...(analyze
        ? [
            visualizer({
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/sgbrbi': {
          target: sgbrProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      /** Vite 7 (rolldown) já faz minify por padrão — não forçar esbuild explicitamente
       *  porque essa versão não embute mais o pacote `esbuild`. */
      target: 'es2022',
      cssCodeSplit: true,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            /** PDF + canvas: usados só em export de relatórios — chunk isolado. */
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) return 'vendor-pdf'
            if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas'
            /** Recharts (~150KB gzip) + d3-* deps — usado só em telas com gráfico. */
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts'
            if (id.includes('node_modules/@tanstack')) return 'vendor-query'
            /** Antd é gigante — chunk próprio cache-friendly entre deploys. */
            if (id.includes('node_modules/antd') || id.includes('node_modules/rc-') || id.includes('node_modules/@rc-component')) return 'vendor-antd'
            if (id.includes('node_modules/@ant-design')) return 'vendor-antd-icons'
            /** React core — raramente muda, vale separar. */
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) return 'vendor-react'
            if (id.includes('node_modules/react-router')) return 'vendor-router'
            if (id.includes('node_modules/dayjs')) return 'vendor-dayjs'
            if (id.includes('node_modules/zod')) return 'vendor-zod'
            return undefined
          },
        },
      },
      chunkSizeWarningLimit: 650,
    },
  }
})

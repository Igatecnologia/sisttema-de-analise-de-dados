/**
 * GitHub Pages não faz rewrite para index.html em rotas profundas.
 * Copiar index.html para 404.html faz o SPA carregar e o React Router assumir a URL.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const indexHtml = resolve(dist, 'index.html')
const notFoundHtml = resolve(dist, '404.html')

if (!existsSync(indexHtml)) {
  console.error('gh-pages-spa-fallback: dist/index.html não encontrado. Rode o build antes.')
  process.exit(1)
}

copyFileSync(indexHtml, notFoundHtml)
console.log('gh-pages-spa-fallback: dist/404.html criado a partir de index.html')

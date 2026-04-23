/**
 * Arquivos em `public/` precisam do `base` do Vite (ex.: GitHub Pages em subpasta).
 * Evita `/logo.png` → raiz do domínio (`github.io/logo.png` 404).
 */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const normalized = path.replace(/^\/+/, '')
  return `${base}${normalized}`
}

import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, '..', 'dist-windows', 'back-end-gest-o')
const target = join(root, 'backend')

if (!existsSync(source)) {
  throw new Error(`Distribuição do backend não encontrada em: ${source}`)
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true })
}

cpSync(source, target, { recursive: true })
console.log(`[desktop-app] Backend copiado para: ${target}`)

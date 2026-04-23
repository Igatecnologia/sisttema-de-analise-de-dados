#!/usr/bin/env node
/**
 * Gera `installer/assets/logo.ico` a partir do PNG transparente da marca.
 * - Faz padding para quadrado (256x256) centralizando o logo com fundo transparente.
 * - Produz um ICO multi-resolução (16, 24, 32, 48, 64, 128, 256) para renderizar
 *   bonito em taskbar, explorer, alt+tab e tela de propriedades do arquivo.
 *
 * Rode com: node scripts/build-icon.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const SRC_PNG = resolve(repoRoot, '..', 'novo site', 'public', 'brand', 'iga-logo.png')
const OUT_ICO = resolve(repoRoot, 'installer', 'assets', 'logo.ico')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

/** Locais que recebem a versão PNG "sem fundo" da marca (splash + SPA dev + SPA empacotada). */
const PNG_TARGETS = [
  resolve(repoRoot, 'desktop-app', 'assets', 'logo.png'),
  resolve(repoRoot, 'front-end-gest-o', 'public', 'logo.png.png'),
  resolve(repoRoot, 'desktop-app', 'backend', 'front-end-dist', 'logo.png.png'),
]

const require = createRequire(import.meta.url)
const { Jimp } = require('jimp')
const pngToIcoMod = require('png-to-ico')
const pngToIco = pngToIcoMod.default ?? pngToIcoMod

async function run() {
  if (!existsSync(SRC_PNG)) {
    console.error(`[build-icon] PNG fonte não encontrado: ${SRC_PNG}`)
    process.exit(1)
  }

  console.log(`[build-icon] lendo ${SRC_PNG}`)
  const img = await Jimp.read(SRC_PNG)

  /**
   * "Sem fundo" aqui = transparente fora do retângulo azul do logo. O interior
   * (incluindo o texto branco "AUTOMAÇÃO & TECNOLOGIA") faz parte do design e
   * NÃO deve ser removido — tentar isso apaga o texto em vez do fundo.
   * O PNG oficial já vem com o redor transparente; só precisamos padronizar
   * para quadrado para o ICO.
   */

  /** Padding: largura virtual = maior dimensão. Fundo transparente (0x00000000). */
  const side = Math.max(img.bitmap.width, img.bitmap.height)
  const square = new Jimp({ width: side, height: side, color: 0x00000000 })
  square.composite(img, Math.floor((side - img.bitmap.width) / 2), Math.floor((side - img.bitmap.height) / 2))

  const buffers = []
  for (const size of SIZES) {
    const resized = square.clone().resize({ w: size, h: size })
    const buf = await resized.getBuffer('image/png')
    buffers.push(buf)
  }

  const ico = await pngToIco(buffers)
  if (!existsSync(dirname(OUT_ICO))) mkdirSync(dirname(OUT_ICO), { recursive: true })
  writeFileSync(OUT_ICO, ico)
  console.log(`[build-icon] OK — ${OUT_ICO} (${ico.length} bytes, ${SIZES.length} resoluções)`)

  /** Propaga a versão "sem fundo" para splash + SPA (tudo rendering idêntico). */
  const pngBuf = await square.getBuffer('image/png')
  for (const target of PNG_TARGETS) {
    if (!existsSync(dirname(target))) continue
    writeFileSync(target, pngBuf)
    console.log(`[build-icon] PNG sem fundo → ${target}`)
  }
}

run().catch((err) => {
  console.error('[build-icon] erro:', err)
  process.exit(1)
})

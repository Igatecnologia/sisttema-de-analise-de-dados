import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets')
const MAX_ENTRY_BYTES = 400 * 1024
const MAX_PDF_CHUNK_BYTES = 450 * 1024

function isJsAsset(fileName) {
  return fileName.endsWith('.js')
}

function asKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

async function main() {
  const files = await readdir(DIST_ASSETS)
  const jsFiles = files.filter(isJsAsset)
  if (!jsFiles.length) {
    throw new Error('Nenhum chunk JS encontrado em dist/assets. Rode npm run build antes.')
  }

  const entries = []
  for (const file of jsFiles) {
    const filePath = join(DIST_ASSETS, file)
    const fileStat = await stat(filePath)
    entries.push({ file, size: fileStat.size })
  }

  const mainEntry = entries.find((item) => item.file.startsWith('index-'))
  if (!mainEntry) {
    throw new Error('Chunk principal index-*.js não encontrado para validação de budget.')
  }

  const pdfChunk = entries.find((item) => item.file.includes('vendor-pdf'))

  const errors = []
  if (mainEntry.size > MAX_ENTRY_BYTES) {
    errors.push(
      `Chunk inicial acima do budget: ${mainEntry.file} (${asKb(mainEntry.size)}) > ${asKb(MAX_ENTRY_BYTES)}`,
    )
  }
  if (pdfChunk && pdfChunk.size > MAX_PDF_CHUNK_BYTES) {
    errors.push(
      `Chunk de exportação PDF acima do budget: ${pdfChunk.file} (${asKb(pdfChunk.size)}) > ${asKb(MAX_PDF_CHUNK_BYTES)}`,
    )
  }

  console.log('Bundle budgets:')
  console.log(`- entry: ${mainEntry.file} (${asKb(mainEntry.size)})`)
  if (pdfChunk) console.log(`- pdf: ${pdfChunk.file} (${asKb(pdfChunk.size)})`)

  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

/**
 * Story 17.8 smoke test — run extractFile() against a real local file.
 *
 * Exercises the REAL extraction paths (live Claude Haiku for PDFs, mammoth/SheetJS/
 * papaparse for office/text) — the unit tests mock these, so this confirms the
 * actual prompt + document-block + converters produce sensible markdown.
 *
 * Usage:
 *   npx tsx scripts/smoke-extract-file.ts <path-to-file> [mimeOverride]
 *
 * Examples:
 *   npx tsx scripts/smoke-extract-file.ts ./sample.pdf
 *   npx tsx scripts/smoke-extract-file.ts ./scanned.pdf            # OCR path
 *   npx tsx scripts/smoke-extract-file.ts ./policy.docx
 *   npx tsx scripts/smoke-extract-file.ts ./krav.xlsx
 *
 * Needs ANTHROPIC_API_KEY (from .env.local / .env) for the PDF path.
 */

import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { extname, basename } from 'path'

// Load env (local overrides base; dotenv does not clobber already-set vars).
config({ path: '.env.local' })
config({ path: '.env' })

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
}

async function main() {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx scripts/smoke-extract-file.ts <path> [mime]')
    process.exit(1)
  }
  const mime = process.argv[3] ?? EXT_TO_MIME[extname(path).toLowerCase()]
  if (!mime) {
    console.error(
      `Could not infer MIME from "${extname(path)}". Pass it explicitly as arg 2.`
    )
    process.exit(1)
  }

  const buffer = readFileSync(path)
  console.log(`\n→ ${basename(path)}  (${mime}, ${buffer.length} bytes)\n`)

  // Imported after env load so the Anthropic client sees ANTHROPIC_API_KEY.
  const { extractFile } = await import('@/lib/documents/extract-file')

  const t0 = Date.now()
  const result = await extractFile(buffer, mime)
  const ms = Date.now() - t0

  console.log('─'.repeat(60))
  console.log(`status:    ${result.status}`)
  console.log(`truncated: ${result.truncated ?? false}`)
  console.log(`usage:     ${result.usage ? JSON.stringify(result.usage) : '—'}`)
  console.log(`chars:     ${result.markdown?.length ?? 0}`)
  console.log(`took:      ${ms}ms`)
  console.log('─'.repeat(60))
  if (result.markdown) {
    console.log('\n── markdown preview (first 1500 chars) ──\n')
    console.log(result.markdown.slice(0, 1500))
    if (result.markdown.length > 1500)
      console.log('\n… (truncated for preview)')
  }
}

main().catch((err) => {
  console.error('smoke test failed:', err)
  process.exit(1)
})

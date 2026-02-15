#!/usr/bin/env node
/**
 * Extract § counts from original AFS PDFs for comparison with DB
 * Uses unpdf text extraction to scan original content
 */

const fs = require('fs')
const path = require('path')

const PDF_DIR = path.resolve(__dirname, '../data/afs-pdfs')

// We need to use dynamic import for unpdf (ESM module)
async function run() {
  const { extractText } = await import('unpdf')

  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.endsWith('.pdf'))
    .sort()

  console.log(
    'PDF File'.padEnd(22),
    'Pages'.padEnd(8),
    'Unique §'.padEnd(10),
    'Highest §'.padEnd(12),
    'Total refs'
  )
  console.log('='.repeat(70))

  for (const file of files) {
    const filePath = path.join(PDF_DIR, file)
    const buffer = fs.readFileSync(filePath)
    const data = new Uint8Array(buffer)

    try {
      const result = await extractText(data, { mergePages: true })
      const text = Array.isArray(result.text)
        ? result.text.join('\n')
        : result.text
      const pages = result.totalPages || 0

      // Count paragraphs
      const matches = text.match(/\b(\d+(?:\s*[a-z])?\s*§)/g) || []
      const unique = new Set(matches.map((m) => m.replace(/\s+/g, ' ').trim()))
      const list = [...unique].sort((a, b) => parseInt(a) - parseInt(b))
      const nums = list.map((s) => parseInt(s)).filter((n) => !isNaN(n))
      const lastNum = nums.length > 0 ? Math.max(...nums) : 0

      const docNum = file
        .replace('.pdf', '')
        .replace('AFS-', 'AFS ')
        .replace(/-/g, ':')
      console.log(
        docNum.padEnd(22),
        String(pages).padEnd(8),
        String(unique.size).padEnd(10),
        String(lastNum || '-').padEnd(12),
        matches.length
      )
    } catch (err) {
      console.log(file.padEnd(22), 'ERROR:', err.message)
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

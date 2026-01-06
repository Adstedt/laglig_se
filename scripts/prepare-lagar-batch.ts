import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { downloadPdf } from '../lib/supabase/storage'
import {
  AMENDMENT_PDF_SYSTEM_PROMPT,
  getAmendmentPdfUserPrompt,
} from '../lib/sfs/amendment-llm-prompt'

const prisma = new PrismaClient()

const MODEL = 'claude-sonnet-4-5-20250929'
const MAX_TOKENS = 16000

async function main() {
  // Get lagar that haven't been processed yet
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { title: { contains: 'Lag (' } },
        { title: { contains: 'Lag om' } },
      ]
    },
    select: {
      id: true,
      sfs_number: true,
      title: true,
      storage_path: true,
      base_law_sfs: true,
      base_law_name: true,
    },
    take: 200,
  })

  console.log(`Found ${amendments.length} lagar in AmendmentDocument`)

  // Check which ones already have html_content in LegalDocument
  const processed = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null }
    },
    select: { document_number: true }
  })

  const processedSet = new Set(processed.map(d => d.document_number))

  // Filter to unprocessed lagar
  const toProcess = amendments.filter(a => {
    const docNum = `SFS ${a.sfs_number}`
    return !processedSet.has(docNum) && a.storage_path
  }).slice(0, 100)

  console.log(`Preparing batch for ${toProcess.length} unprocessed lagar`)

  const requests: object[] = []
  let failed = 0

  for (const amendment of toProcess) {
    console.log(`Processing ${amendment.sfs_number}...`)

    // Strip "SFS " prefix for storage lookup
    const sfsForStorage = amendment.sfs_number.replace(/^SFS\s*/i, '')

    // Download PDF
    const pdfBuffer = await downloadPdf(sfsForStorage)
    if (!pdfBuffer) {
      console.warn(`  Failed to download PDF for ${amendment.sfs_number}`)
      failed++
      continue
    }

    // Convert to base64
    const pdfBase64 = pdfBuffer.toString('base64')
    // Strip "SFS " prefix before normalizing (DB stores "SFS 2025:18", we want "2025-18")
    const sfsWithoutPrefix = amendment.sfs_number.replace(/^SFS\s*/i, '')
    const normalizedSfs = sfsWithoutPrefix.replace(/[^a-zA-Z0-9_-]/g, '-')

    requests.push({
      custom_id: `SFS${normalizedSfs}`,
      params: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: AMENDMENT_PDF_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: getAmendmentPdfUserPrompt(
                  amendment.sfs_number,
                  amendment.title ?? undefined,
                  amendment.base_law_sfs,
                  amendment.base_law_name ?? undefined
                ),
              },
            ],
          },
        ],
      },
    })

    console.log(`  ✓ Added ${amendment.sfs_number}`)
  }

  // Write JSONL file
  const jsonl = requests.map(r => JSON.stringify(r)).join('\n')
  writeFileSync('batches/lagar-test-100.jsonl', jsonl)

  console.log(`\nWrote batches/lagar-test-100.jsonl`)
  console.log(`  Prepared: ${requests.length}`)
  console.log(`  Failed: ${failed}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

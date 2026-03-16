import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { downloadPdfByPath } from '../lib/supabase/storage'
import {
  AMENDMENT_PDF_SYSTEM_PROMPT,
  getAmendmentPdfUserPrompt,
} from '../lib/sfs/amendment-llm-prompt'

const prisma = new PrismaClient()
const anthropic = new Anthropic()
const SFS_NUMBER = 'SFS 2025:1461'

async function main() {
  // 1. Get the amendment document to find the storage path
  const amendment = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: SFS_NUMBER },
    select: {
      id: true,
      sfs_number: true,
      storage_path: true,
      base_law_sfs: true,
      title: true,
    },
  })
  if (!amendment?.storage_path) {
    console.log('Amendment not found or no storage_path')
    return
  }
  console.log(`Found: ${amendment.sfs_number} — ${amendment.title}`)
  console.log(`Storage: ${amendment.storage_path}`)

  // 2. Download the PDF
  console.log('Downloading PDF...')
  const pdfBuffer = await downloadPdfByPath(amendment.storage_path)
  if (!pdfBuffer) {
    console.log('Failed to download PDF')
    return
  }
  console.log(`PDF: ${pdfBuffer.length} bytes`)

  // 3. Call Claude API directly with the new prompt
  console.log('Calling Claude API with updated canonical prompt...')
  const pdfBase64 = pdfBuffer.toString('base64')

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 32768,
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
              amendment.sfs_number.replace(/^SFS\s*/i, ''),
              amendment.base_law_sfs ?? undefined,
              amendment.title ?? undefined
            ),
          },
        ],
      },
    ],
  })

  process.stdout.write('Streaming')
  stream.on('text', () => process.stdout.write('.'))
  const response = await stream.finalMessage()
  console.log(' done')

  // 4. Extract HTML from response, strip markdown fences if present
  let htmlContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
  htmlContent = htmlContent
    .replace(/^```html\s*\n?/, '')
    .replace(/\n?```\s*$/, '')

  console.log(`\nResponse: ${htmlContent.length} chars`)
  console.log(`Stop reason: ${response.stop_reason}`)
  console.log(
    `Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  )

  // Check markers
  console.log(`\nMarkers:`)
  console.log(
    `  a.paragraf: ${(htmlContent.match(/class="paragraf"/g) || []).length}`
  )
  console.log(
    `  h3.paragraph: ${(htmlContent.match(/class="paragraph"/g) || []).length}`
  )
  console.log(
    `  section.ann: ${(htmlContent.match(/class="ann"/g) || []).length}`
  )
  console.log(`  div.annzone: ${(htmlContent.match(/annzone/g) || []).length}`)
  console.log(`  div.N2: ${(htmlContent.match(/class="N2"/g) || []).length}`)
  console.log(
    `  kapitel-rubrik: ${(htmlContent.match(/kapitel-rubrik/g) || []).length}`
  )
  console.log(
    `  span.kapitel: ${(htmlContent.match(/class="kapitel"/g) || []).length}`
  )
  console.log(
    `  section.group: ${(htmlContent.match(/class="group"/g) || []).length}`
  )

  // Save to file for review
  writeFileSync('data/tmp-2025-1461-new-prompt.html', htmlContent)
  console.log(`\nSaved to data/tmp-2025-1461-new-prompt.html`)

  // 5. Update the DB
  const updated = await prisma.legalDocument.updateMany({
    where: { document_number: SFS_NUMBER },
    data: { html_content: htmlContent },
  })
  console.log(`Updated ${updated.count} LegalDocument(s) in DB`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

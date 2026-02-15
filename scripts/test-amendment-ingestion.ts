/**
 * Test script: Process a single amendment PDF through the LLM pipeline
 * and upsert the resulting HTML to the LegalDocument.
 *
 * Usage:
 *   npx tsx scripts/test-amendment-ingestion.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { parseAmendmentPdf } from '@/lib/external/llm-amendment-parser'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '@/lib/transforms/html-to-markdown'
import { htmlToJson } from '@/lib/transforms/html-to-json'

const prisma = new PrismaClient()

// Target document
const SLUG =
  'lag-om-andring-i-forordningen-om-statligt-stod-for-installation-av-laddningspunkter-for-elfordon-2025-1456'

async function main() {
  // 1. Fetch document from DB
  console.log('=== Step 1: Fetching document from DB ===')
  const doc = await prisma.legalDocument.findFirst({
    where: { slug: SLUG },
    select: {
      id: true,
      document_number: true,
      title: true,
      source_url: true,
      metadata: true,
    },
  })

  if (!doc) {
    console.error('Document not found:', SLUG)
    process.exit(1)
  }

  console.log('  Document:', doc.document_number)
  console.log('  Title:', doc.title)
  console.log('  Source:', doc.source_url)

  const metadata = doc.metadata as Record<string, unknown>
  const sfsNumber = doc.document_number.replace('SFS ', '')
  const baseLawSfs = (metadata?.base_law_sfs as string) || undefined
  const baseLawName = (metadata?.base_law_name as string) || undefined

  // 2. Download PDF
  console.log('\n=== Step 2: Downloading PDF ===')
  if (!doc.source_url) {
    console.error('No source URL for PDF')
    process.exit(1)
  }

  const pdfResponse = await fetch(doc.source_url)
  if (!pdfResponse.ok) {
    console.error(
      'Failed to download PDF:',
      pdfResponse.status,
      pdfResponse.statusText
    )
    process.exit(1)
  }

  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
  console.log('  PDF size:', (pdfBuffer.length / 1024).toFixed(1), 'KB')

  // 3. Send to Claude
  console.log('\n=== Step 3: Sending PDF to Claude ===')
  console.log('  SFS:', sfsNumber)
  console.log('  Base law:', baseLawSfs, baseLawName)

  const startTime = Date.now()
  const { html, validation } = await parseAmendmentPdf(
    pdfBuffer,
    sfsNumber,
    baseLawSfs,
    doc.title || undefined,
    { maxRetries: 2 }
  )
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('  Elapsed:', elapsed, 's')
  console.log('  Valid:', validation.valid)
  console.log('  HTML length:', html.length)
  console.log('  Sections:', validation.metrics.sectionCount)
  console.log('  Paragraphs:', validation.metrics.paragraphCount)
  console.log(
    '  Has transition provisions:',
    validation.metrics.hasTransitionProvisions
  )

  if (validation.errors.length > 0) {
    console.log('  Warnings:')
    for (const err of validation.errors) {
      console.log(`    [${err.severity}] ${err.code}: ${err.message}`)
    }
  }

  // 4. Derive other content formats
  console.log('\n=== Step 4: Deriving content formats ===')
  const markdownContent = htmlToMarkdown(html)
  const jsonContent = htmlToJson(html, {
    sfsNumber,
    baseLawSfs,
    documentType: 'amendment',
  })
  const fullText = htmlToPlainText(html)

  console.log('  Markdown:', markdownContent.length, 'chars')
  console.log('  JSON sections:', jsonContent.sections.length)
  console.log('  Plain text:', fullText.length, 'chars')

  // 5. Preview HTML (first 2000 chars)
  console.log('\n=== Step 5: HTML Preview (first 2000 chars) ===')
  console.log(html.substring(0, 2000))
  console.log('...')

  // 6. Upsert to DB
  console.log('\n=== Step 6: Upserting to DB ===')
  await prisma.legalDocument.update({
    where: { id: doc.id },
    data: {
      html_content: html,
      markdown_content: markdownContent,
      json_content: jsonContent as never,
      full_text: fullText,
    },
  })

  console.log('  Updated successfully!')
  console.log(
    `\n  View at: http://localhost:3000/browse/lagar/andringar/${SLUG}`
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

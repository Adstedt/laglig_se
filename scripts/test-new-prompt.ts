#!/usr/bin/env tsx
/**
 * Test the updated LLM prompt on a single document
 * and update the database with the new output
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { downloadPdf, getStoragePath, getStorageClient } from '../lib/supabase/storage'
import {
  AMENDMENT_PDF_SYSTEM_PROMPT,
  getAmendmentPdfUserPrompt,
} from '../lib/sfs/amendment-llm-prompt'

const BUCKET_NAME = 'sfs-pdfs'

/**
 * Try to download PDF from storage, fallback to government source
 */
async function getPdfBuffer(sfsNumber: string): Promise<Buffer | null> {
  // Normalize SFS number (remove "SFS " prefix if present)
  const normalizedSfs = sfsNumber.replace(/^SFS\s*/i, '')

  // First try Supabase storage
  const storagePath = getStoragePath(normalizedSfs)
  console.log('Trying storage path:', storagePath)

  try {
    const client = getStorageClient()
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .download(storagePath)

    if (data && !error) {
      const arrayBuffer = await data.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
    console.log('Storage download failed:', error?.message)
  } catch (e) {
    console.log('Storage error:', e)
  }

  // Fallback: download from government source
  console.log('Trying government source...')
  const govUrl = `https://rkrattsbaser.gov.se/sfsr?bet=${normalizedSfs}`

  try {
    const response = await fetch(govUrl)
    if (response.ok) {
      const html = await response.text()
      // Look for PDF link in the HTML
      const pdfMatch = html.match(/href="([^"]*\.pdf[^"]*)"/i)
      if (pdfMatch) {
        const pdfUrl = pdfMatch[1].startsWith('http')
          ? pdfMatch[1]
          : `https://rkrattsbaser.gov.se${pdfMatch[1]}`
        console.log('Found PDF URL:', pdfUrl)
        const pdfResponse = await fetch(pdfUrl)
        if (pdfResponse.ok) {
          const arrayBuffer = await pdfResponse.arrayBuffer()
          return Buffer.from(arrayBuffer)
        }
      }
    }
  } catch (e) {
    console.log('Gov source error:', e)
  }

  return null
}
import { validateLlmOutput } from '../lib/sfs/llm-output-validator'
import { htmlToMarkdown, htmlToPlainText } from '../lib/transforms/html-to-markdown'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  const sfsNumber = process.argv[2] || '2025:57'

  console.log('='.repeat(60))
  console.log(`Testing new prompt on SFS ${sfsNumber}`)
  console.log('='.repeat(60))
  console.log('')

  // 1. Get amendment info
  const amendment = await prisma.amendmentDocument.findFirst({
    where: {
      OR: [
        { sfs_number: sfsNumber },
        { sfs_number: `SFS ${sfsNumber}` },
      ]
    }
  })

  if (!amendment) {
    console.error(`Amendment ${sfsNumber} not found`)
    process.exit(1)
  }

  console.log('Found amendment:', amendment.title)
  console.log('Base law:', amendment.base_law_sfs)
  console.log('')

  // 2. Download PDF
  console.log('Downloading PDF...')
  const pdfBuffer = await getPdfBuffer(amendment.sfs_number)
  if (!pdfBuffer) {
    console.error('Failed to download PDF from any source')
    process.exit(1)
  }
  console.log(`PDF downloaded: ${pdfBuffer.length} bytes`)
  console.log('')

  // 3. Call Claude with new prompt
  console.log('Calling Claude with updated prompt...')
  const anthropic = new Anthropic()

  const pdfBase64 = pdfBuffer.toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
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
              amendment.base_law_sfs ?? undefined,
              amendment.title ?? undefined
            ),
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    console.error('No text response from Claude')
    process.exit(1)
  }

  const rawHtml = textContent.text
  console.log(`Response received: ${rawHtml.length} chars`)
  console.log('')

  // 4. Validate output
  console.log('Validating output...')
  const validation = validateLlmOutput(rawHtml, sfsNumber)

  if (!validation.valid) {
    console.error('Validation failed:', validation.errors)
    process.exit(1)
  }

  if (validation.warnings.length > 0) {
    console.log('Warnings:', validation.warnings)
  }

  console.log('Validation passed!')
  console.log('')

  // 5. Show sample of new output
  console.log('='.repeat(60))
  console.log('NEW OUTPUT SAMPLE (first 2000 chars):')
  console.log('='.repeat(60))
  console.log(validation.cleanedHtml?.substring(0, 2000))
  console.log('')
  console.log('...')
  console.log('')

  // Check for version-references section
  const hasVersionRefs = validation.cleanedHtml?.includes('class="version-references"')
  console.log('Has version-references section:', hasVersionRefs)

  // Check for clean paragraph headers (no superscript on §)
  const hasDirtyHeaders = validation.cleanedHtml?.match(/<h3 class="paragraph">[^<]*§<sup/)
  console.log('Has clean paragraph headers:', !hasDirtyHeaders)
  console.log('')

  // 6. Update database
  console.log('Updating database...')

  const htmlContent = validation.cleanedHtml!
  const markdownContent = htmlToMarkdown(htmlContent)
  const jsonContent = htmlToJson(htmlContent, {
    sfsNumber,
    documentType: 'amendment',
  })
  const plainText = htmlToPlainText(htmlContent)

  const documentNumber = `SFS ${sfsNumber}`

  await prisma.legalDocument.update({
    where: { document_number: documentNumber },
    data: {
      html_content: htmlContent,
      markdown_content: markdownContent,
      json_content: jsonContent as any,
      full_text: plainText,
      updated_at: new Date(),
    },
  })

  console.log('Database updated!')
  console.log('')
  console.log('='.repeat(60))
  console.log('Done! Refresh the page to see the new rendering.')
  console.log('='.repeat(60))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})

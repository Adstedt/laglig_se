/* eslint-disable no-console */
/**
 * Simple HTML backfill - processes one document at a time
 *
 * Run with: pnpm tsx scripts/backfill-eu-html-simple.ts
 */

import { PrismaClient } from '@prisma/client'
import { fetchDocumentContentViaCellar } from '../lib/external/eurlex'

const DELAY_MS = 500

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const startTime = Date.now()

  // Create fresh Prisma client for each operation
  async function getDocIds(): Promise<Array<{ id: string; celex: string }>> {
    const prisma = new PrismaClient()
    try {
      const docs = await prisma.legalDocument.findMany({
        where: {
          content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
          html_content: null,
          // Skip correction documents
          NOT: {
            document_number: { contains: 'R(' },
          },
        },
        select: { id: true, document_number: true },
        orderBy: { created_at: 'desc' },
      })
      return docs.map((d) => ({ id: d.id, celex: d.document_number }))
    } finally {
      await prisma.$disconnect()
    }
  }

  async function updateDoc(
    id: string,
    html: string,
    plainText: string
  ): Promise<void> {
    const prisma = new PrismaClient()
    try {
      await prisma.legalDocument.update({
        where: { id },
        data: {
          html_content: html,
          full_text: plainText,
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  }

  console.log('Fetching document IDs...')
  const docIds = await getDocIds()
  console.log(`Found ${docIds.length} documents to process\n`)

  let updated = 0
  let failed = 0

  for (let i = 0; i < docIds.length; i++) {
    const { id, celex } = docIds[i]
    const progress = (((i + 1) / docIds.length) * 100).toFixed(1)

    try {
      const content = await fetchDocumentContentViaCellar(celex)

      if (content && content.html) {
        await updateDoc(id, content.html, content.plainText)
        updated++
        const sizeKB = Math.round(content.html.length / 1024)
        console.log(
          `[${i + 1}/${docIds.length}] ✓ ${celex} (${sizeKB}KB) - ${progress}%`
        )
      } else {
        failed++
        console.log(
          `[${i + 1}/${docIds.length}] ✗ ${celex} (no content) - ${progress}%`
        )
      }
    } catch (err) {
      failed++
      const msg =
        err instanceof Error ? err.message.split('\n')[0] : String(err)
      console.log(
        `[${i + 1}/${docIds.length}] ✗ ${celex}: ${msg} - ${progress}%`
      )
    }

    await sleep(DELAY_MS)

    // Log progress every 50 docs
    if ((i + 1) % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
      console.log(
        `\n--- Progress: ${updated} updated, ${failed} failed, ${elapsed} min elapsed ---\n`
      )
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log('\n' + '='.repeat(50))
  console.log('COMPLETE')
  console.log(`Updated: ${updated}`)
  console.log(`Failed: ${failed}`)
  console.log(`Duration: ${duration} min`)
}

main().catch(console.error)

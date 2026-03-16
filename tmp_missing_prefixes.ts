import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  // Approach 1: Check errored batch requests from Anthropic API directly
  const progressFile = path.join(__dirname, 'data', 'batch-progress.json')
  const progress = JSON.parse(fs.readFileSync(progressFile, 'utf-8'))
  const requestMap = progress.requestMap as Record<
    string,
    { docId: string; chunkPaths: string[] }
  >

  const anthropic = new Anthropic()
  const erroredDocs = new Set<string>()
  const erroredCustomIds: string[] = []

  console.log('Scanning batch results for errors...\n')

  for (const entry of progress.batches) {
    const status = await anthropic.messages.batches.retrieve(entry.batchId)
    const counts = status.request_counts
    if (counts.errored === 0) continue

    console.log(
      `Batch ${entry.batchId}: ${counts.errored} errors — streaming results...`
    )
    const decoder = await anthropic.messages.batches.results(entry.batchId)

    for await (const item of decoder) {
      if (item.result.type !== 'succeeded') {
        erroredCustomIds.push(item.custom_id)
        const mapping = requestMap[item.custom_id]
        if (mapping) {
          erroredDocs.add(mapping.docId)
          console.log(
            `  ERROR: ${item.custom_id} → doc ${mapping.docId} (${mapping.chunkPaths.length} chunks)`
          )
          console.log(`    Type: ${item.result.type}`)
          if (item.result.type === 'errored' && 'error' in item.result) {
            console.log(
              `    Error: ${JSON.stringify((item.result as any).error)}`
            )
          }
        }
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`Total errored requests: ${erroredCustomIds.length}`)
  console.log(`Total affected docs: ${erroredDocs.size}`)

  // Look up the affected docs
  if (erroredDocs.size > 0) {
    console.log(`\nAffected documents:`)
    for (const docId of erroredDocs) {
      const doc = await prisma.legalDocument.findUnique({
        where: { id: docId },
        select: { title: true, document_number: true, markdown_content: true },
      })
      if (!doc) continue
      const sizeKB = ((doc.markdown_content?.length || 0) / 1024).toFixed(0)

      // Count chunks for this doc
      const chunkCount = await prisma.contentChunk.count({
        where: { source_id: docId },
      })
      const withPrefix = await prisma.contentChunk.count({
        where: { source_id: docId, context_prefix: { not: null } },
      })

      console.log(
        `  ${doc.document_number}: "${doc.title}" — ${sizeKB}KB, ${withPrefix}/${chunkCount} chunks with prefix`
      )
    }
  }

  // Also quick summary using the counts we already have
  console.log(
    `\nOverall: 194,652 / 228,778 chunks have prefix (from earlier check)`
  )
  console.log(`Missing: ~${228778 - 194652} chunks without prefix`)

  await prisma.$disconnect()
}

main()

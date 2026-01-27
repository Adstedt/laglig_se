import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  // Get amendments with html_content
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      json_content: true,
    },
    take: 10,
    orderBy: { document_number: 'asc' },
  })

  console.log(
    `\nTesting footnote extraction fix on ${docs.length} amendments...\n`
  )

  let totalFootnotes = 0
  let totalRefs = 0

  for (const doc of docs) {
    console.log('='.repeat(70))
    console.log('Document:', doc.document_number)

    // Re-parse HTML with updated parser
    const freshJson = htmlToJson(doc.html_content || '', {
      documentType: 'amendment',
    })

    console.log(`Footnotes found: ${freshJson.footnotes.length}`)

    for (const fn of freshJson.footnotes) {
      console.log(
        `  [${fn.id}]: ${fn.content.substring(0, 80)}${fn.content.length > 80 ? '...' : ''}`
      )
      if (fn.legislativeRefs && fn.legislativeRefs.length > 0) {
        console.log(
          `    → Legislative refs: ${fn.legislativeRefs.map((r) => r.reference).join(', ')}`
        )
      }
    }

    console.log(
      `Legislative references (aggregated): ${freshJson.legislativeReferences.length}`
    )
    for (const ref of freshJson.legislativeReferences) {
      console.log(
        `  - ${ref.type}: ${ref.reference} (year: ${ref.year}, num: ${ref.number})`
      )
    }

    totalFootnotes += freshJson.footnotes.length
    totalRefs += freshJson.legislativeReferences.length
    console.log('')
  }

  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total documents: ${docs.length}`)
  console.log(`Total footnotes extracted: ${totalFootnotes}`)
  console.log(`Total legislative references: ${totalRefs}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

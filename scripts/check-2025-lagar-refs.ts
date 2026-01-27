import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  // Get 2025 lagar with html_content
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
      document_number: { startsWith: 'SFS 2025' },
      title: { contains: 'Lag' },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    take: 20,
  })

  console.log(`Found ${docs.length} 2025 lagar with html_content\n`)

  let totalRefs = 0

  for (const doc of docs) {
    const json = htmlToJson(doc.html_content || '', {
      documentType: 'amendment',
    })

    console.log(`${doc.document_number}: ${doc.title?.substring(0, 50)}`)
    console.log(`  Footnotes: ${json.footnotes.length}`)

    for (const fn of json.footnotes.slice(0, 3)) {
      console.log(`    [${fn.id}]: ${fn.content.substring(0, 60)}...`)
      if (fn.legislativeRefs && fn.legislativeRefs.length > 0) {
        console.log(
          `      → Refs: ${fn.legislativeRefs.map((r) => r.reference).join(', ')}`
        )
      }
    }

    if (json.legislativeReferences.length > 0) {
      totalRefs += json.legislativeReferences.length
      console.log(`  Legislative refs: ${json.legislativeReferences.length}`)
    }
    console.log('')
  }

  console.log('='.repeat(60))
  console.log(`Total legislative refs in 2025 lagar: ${totalRefs}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

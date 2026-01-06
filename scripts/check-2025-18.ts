import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: '2025-18' } },
    select: { document_number: true, title: true, html_content: true }
  })

  if (!doc) {
    console.log('Not found')
    return
  }

  console.log('Document:', doc.document_number)
  console.log('Title:', doc.title)
  console.log('')

  // Parse HTML
  const json = htmlToJson(doc.html_content || '', { documentType: 'amendment' })

  console.log('Footnotes:', json.footnotes.length)
  for (const fn of json.footnotes) {
    console.log(`  [${fn.id}]: ${fn.content.substring(0, 100)}`)
    if (fn.legislativeRefs && fn.legislativeRefs.length > 0) {
      console.log(`    → Legislative refs: ${fn.legislativeRefs.map(r => r.reference).join(', ')}`)
    }
  }

  console.log('\nAggregated Legislative References:', json.legislativeReferences.length)
  for (const ref of json.legislativeReferences) {
    console.log(`  - ${ref.type}: ${ref.reference} (year: ${ref.year}, num: ${ref.number})`)
  }

  // Show first 500 chars of HTML to verify structure
  console.log('\nFirst 500 chars of HTML:')
  console.log(doc.html_content?.substring(0, 500))
}

main().catch(console.error).finally(() => prisma.$disconnect())

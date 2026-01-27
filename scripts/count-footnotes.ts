import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface JsonContent {
  footnotes?: Array<{
    id: string
    content: string
    legislativeRefs?: unknown[]
  }>
  legislativeReferences?: Array<{ type: string; reference: string }>
}

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      json_content: true,
    },
  })

  let totalFootnotes = 0
  let docsWithFootnotes = 0
  let totalLegRefs = 0
  let docsWithLegRefs = 0

  for (const doc of docs) {
    const json = doc.json_content as JsonContent | null
    const fnCount = json?.footnotes?.length || 0
    const refCount = json?.legislativeReferences?.length || 0

    totalFootnotes += fnCount
    totalLegRefs += refCount
    if (fnCount > 0) docsWithFootnotes++
    if (refCount > 0) docsWithLegRefs++
  }

  console.log('Footnote Statistics (processed docs):')
  console.log('  Total documents:', docs.length)
  console.log('  Total footnotes:', totalFootnotes)
  console.log('  Docs with footnotes:', docsWithFootnotes)
  console.log('')
  console.log('Legislative References:')
  console.log('  Total refs:', totalLegRefs)
  console.log('  Docs with refs:', docsWithLegRefs)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface JsonContent {
  legislativeReferences?: Array<{
    type: string
    reference: string
    year: string
    number: string
  }>
  footnotes?: Array<{
    id: string
    content: string
    legislativeRefs?: unknown[]
  }>
}

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:151' },
    select: { document_number: true, json_content: true }
  })

  console.log('=== Storage Location ===')
  console.log('Table: legal_documents')
  console.log('Column: json_content (JSONB)')
  console.log('')
  console.log('Document:', doc?.document_number)
  console.log('')

  const json = doc?.json_content as JsonContent | null

  console.log('json_content.legislativeReferences:')
  console.log(JSON.stringify(json?.legislativeReferences, null, 2))

  console.log('')
  console.log('json_content.footnotes[0] (where refs come from):')
  console.log(JSON.stringify(json?.footnotes?.[0], null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToJson } from '../lib/transforms/html-to-json'

const prisma = new PrismaClient()

async function main() {
  // Get all amendments with html_content that need json_content regenerated
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null }
    },
    select: {
      id: true,
      document_number: true,
      html_content: true
    }
  })

  console.log(`\nRegenerating json_content for ${docs.length} amendments...\n`)

  let updated = 0
  let withRefs = 0
  let totalRefs = 0

  for (const doc of docs) {
    // Re-parse HTML with updated parser
    const freshJson = htmlToJson(doc.html_content || '', { documentType: 'amendment' })

    // Update the database
    await prisma.legalDocument.update({
      where: { id: doc.id },
      data: { json_content: freshJson as object }
    })

    updated++

    if (freshJson.legislativeReferences.length > 0) {
      withRefs++
      totalRefs += freshJson.legislativeReferences.length
      console.log(`${doc.document_number}: ${freshJson.legislativeReferences.length} refs (${freshJson.legislativeReferences.map(r => r.type).join(', ')})`)
    }

    if (updated % 20 === 0) {
      console.log(`Progress: ${updated}/${docs.length}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('COMPLETE')
  console.log('='.repeat(60))
  console.log(`Documents updated: ${updated}`)
  console.log(`Documents with legislative refs: ${withRefs}`)
  console.log(`Total legislative references: ${totalRefs}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

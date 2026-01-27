import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get a doc WITHOUT legislative refs in json
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    select: { document_number: true, html_content: true, json_content: true },
    take: 20,
  })

  for (const doc of docs) {
    const json = doc.json_content as {
      legislativeReferences?: unknown[]
    } | null
    if ((json?.legislativeReferences?.length || 0) === 0) {
      const html = doc.html_content || ''

      // Check if prop/bet/rskr exists ANYWHERE in HTML
      const propMatches = html.match(/[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/g) || []
      const betMatches =
        html.match(/[Bb]et\.\s*\d{4}\/\d{2,4}:[A-Za-z]+\d+/g) || []
      const rskrMatches = html.match(/[Rr]skr\.\s*\d{4}\/\d{2,4}:\d+/g) || []

      console.log('=== Doc without JSON refs:', doc.document_number, '===')
      console.log(
        'Prop in HTML:',
        propMatches.length > 0 ? propMatches : 'NONE'
      )
      console.log('Bet in HTML:', betMatches.length > 0 ? betMatches : 'NONE')
      console.log(
        'Rskr in HTML:',
        rskrMatches.length > 0 ? rskrMatches : 'NONE'
      )

      // Show first 800 chars
      console.log('\nFirst 800 chars:')
      console.log(html.substring(0, 800))
      console.log('\n')
      break
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1998:1003', html_content: { not: null } },
    select: { html_content: true, document_number: true }
  })

  if (!doc?.html_content) {
    console.log('No document found')
    return
  }

  console.log('=== Document:', doc.document_number, '===\n')

  // Show first part to see header structure
  console.log('--- First 1500 chars of HTML ---')
  console.log(doc.html_content.substring(0, 1500))

  // Search for prop/bet/rskr anywhere in full HTML
  console.log('\n--- All prop/bet/rskr in full document ---')
  const html = doc.html_content
  const propMatches = html.match(/[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/g) || []
  const betMatches = html.match(/[Bb]et\.\s*\d{4}\/\d{2,4}:[A-Za-z]+\d+/g) || []
  const rskrMatches = html.match(/[Rr]skr\.\s*\d{4}\/\d{2,4}:\d+/g) || []

  console.log('prop:', propMatches)
  console.log('bet:', betMatches)
  console.log('rskr:', rskrMatches)
}

main().catch(console.error).finally(() => prisma.$disconnect())

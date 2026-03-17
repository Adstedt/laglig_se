import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Get 2 AFS docs: 1 flat, 1 chaptered
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      metadata: { path: ['method'], equals: 'html-scraping' },
    },
    select: { document_number: true, title: true, html_content: true },
    take: 3,
  })

  for (const doc of docs) {
    const html = doc.html_content || ''
    console.log('\n' + '='.repeat(70))
    console.log(`${doc.document_number}: ${(doc.title || '').substring(0, 60)}`)
    console.log(`Size: ${html.length} chars`)
    console.log('='.repeat(70))
    console.log(html.substring(0, 2000))
    console.log('\n... truncated ...\n')
    console.log(html.substring(html.length - 500))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

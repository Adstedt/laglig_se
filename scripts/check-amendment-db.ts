import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check raw count first
  const count = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })
  console.log('Total amendments:', count)

  // Find the specific document
  const doc = await prisma.legalDocument.findFirst({
    where: {
      OR: [
        { document_number: 'SFS 2025:57' },
        {
          slug: 'lag-om-andring-i-lagen-om-mottagande-av-asylsokande-mfl-2025-57',
        },
      ],
    },
    select: {
      id: true,
      document_number: true,
      slug: true,
      content_type: true,
      html_content: true,
      updated_at: true,
    },
  })

  if (doc) {
    console.log('\n=== Found Document ===')
    console.log('ID:', doc.id)
    console.log('Document number:', doc.document_number)
    console.log('Slug:', doc.slug)
    console.log('Type:', doc.content_type)
    console.log('HTML length:', doc.html_content?.length || 0)
    console.log('Updated:', doc.updated_at)

    // Check content
    const html = doc.html_content || ''
    console.log('\nContent checks:')
    console.log(
      '- Has Samhällsintroduktion:',
      html.includes('Samhällsintroduktion')
    )
    console.log('- Has Ikraftträdande:', html.includes('Ikraftträdande'))
    console.log('- Has footer:', html.includes('<footer'))
  } else {
    console.log('\nDocument not found!')

    // List all documents to debug
    const all = await prisma.legalDocument.findMany({
      take: 10,
      select: { document_number: true, slug: true, content_type: true },
    })
    console.log('\nFirst 10 documents:')
    all.forEach((d) =>
      console.log(`  ${d.content_type}: ${d.document_number} -> ${d.slug}`)
    )
  }

  await prisma.$disconnect()
}
main()

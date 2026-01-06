import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null }
    },
    select: {
      document_number: true,
      slug: true,
      title: true,
      html_content: true
    },
    orderBy: { updated_at: 'desc' },
    take: 10
  })

  console.log('Amendments with html_content:', docs.length)
  console.log('')

  for (const doc of docs) {
    console.log('---')
    console.log('SFS:', doc.document_number)
    console.log('Title:', doc.title?.substring(0, 70))
    console.log('Slug:', doc.slug)
    console.log('HTML chars:', doc.html_content?.length)
    console.log('URL: http://localhost:3000/browse/lagar/andringar/' + doc.slug)
  }

  await prisma.$disconnect()
}
main()

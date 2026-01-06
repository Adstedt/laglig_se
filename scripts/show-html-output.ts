import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: { startsWith: 'SFS 1998:100' },
      html_content: { not: null }
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'asc' }
  })
  
  if (!doc) {
    console.log('No document found')
    return
  }
  
  console.log('=== ' + doc.document_number + ' ===')
  console.log('Title:', doc.title)
  console.log('\n--- HTML CONTENT ---\n')
  console.log(doc.html_content)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docNumbers = ['SFS 2010:1460', 'SFS 2010:1461', 'SFS 2019:1204']

  for (const docNum of docNumbers) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: docNum },
      select: { html_content: true, title: true }
    })

    console.log('=== ' + docNum + ' ===')
    console.log('Title:', doc?.title)
    console.log('\nFirst 1200 chars:')
    console.log(doc?.html_content?.substring(0, 1200))
    console.log('\n')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

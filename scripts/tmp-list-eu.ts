import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Look up CBAM specifically
  const cbam = await prisma.euDocument.findUnique({
    where: { celex_number: '32023R0956' },
    include: {
      document: {
        select: {
          id: true,
          document_number: true,
          slug: true,
          title: true,
          content_type: true,
        },
      },
    },
  })
  console.log(
    'CBAM EuDocument:',
    cbam
      ? {
          celex: cbam.celex_number,
          docNumber: cbam.document.document_number,
          slug: cbam.document.slug,
          title: (cbam.document.title || '').substring(0, 80),
          contentType: cbam.document.content_type,
        }
      : 'NOT FOUND'
  )

  // Also check the other test docs
  for (const celex of [
    '32016R0679',
    '32006R0561',
    '32020R0852',
    '32023R0956',
  ]) {
    const eu = await prisma.euDocument.findUnique({
      where: { celex_number: celex },
      include: {
        document: { select: { document_number: true, slug: true } },
      },
    })
    console.log(`  ${celex}: ${eu ? eu.document.slug : 'NOT FOUND'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  const noHtml = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: null },
    select: { document_number: true },
  })

  const sfsNumbers = noHtml.map((d) => d.document_number.replace('SFS ', ''))
  writeFileSync('batches/backfill-5862.txt', sfsNumbers.join('\n'))
  console.log(
    `Wrote ${sfsNumbers.length} SFS numbers to batches/backfill-5862.txt`
  )
  console.log('First 5:', sfsNumbers.slice(0, 5))

  await prisma.$disconnect()
}

main()

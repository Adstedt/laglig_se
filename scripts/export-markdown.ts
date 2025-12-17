import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { startsWith: 'SFS 2024:' } },
    select: { sfs_number: true, markdown_content: true },
    take: 4,
  })

  for (const doc of docs) {
    if (doc.markdown_content) {
      const filename =
        doc.sfs_number.replace('SFS ', 'SFS').replace(':', '-') + '.md'
      fs.writeFileSync('data/' + filename, doc.markdown_content)
      console.log('Written:', filename)
    }
  }

  await prisma.$disconnect()
}
main()

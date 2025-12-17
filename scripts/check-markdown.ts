import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: { startsWith: 'SFS 2024:' } },
    select: { sfs_number: true, title: true, markdown_content: true },
  })

  if (doc) {
    console.log('SFS:', doc.sfs_number)
    console.log('Title:', doc.title)
    console.log('')
    console.log('=== MARKDOWN CONTENT ===')
    if (doc.markdown_content) {
      console.log(doc.markdown_content.substring(0, 2000))
      console.log('...')
    } else {
      console.log('null')
    }
  }

  await prisma.$disconnect()
}
main()

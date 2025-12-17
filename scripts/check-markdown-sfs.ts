import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const sfs = process.argv[2] || 'SFS 2024:1'

async function main() {
  const doc = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: sfs },
    select: {
      sfs_number: true,
      title: true,
      markdown_content: true,
      updated_at: true,
    },
  })

  if (doc) {
    console.log('SFS:', doc.sfs_number)
    console.log('Title:', doc.title)
    console.log('Updated:', doc.updated_at)
    console.log('')
    console.log('=== MARKDOWN CONTENT ===')
    if (doc.markdown_content) {
      console.log(doc.markdown_content)
    } else {
      console.log('null')
    }
  } else {
    console.log('Not found:', sfs)
  }

  await prisma.$disconnect()
}
main()

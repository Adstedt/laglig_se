import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const a = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2000:764' },
    select: { full_text: true, markdown_content: true },
  })

  console.log('=== SFS 2000:764 full_text ===')
  console.log(a?.full_text)
  console.log('\n' + '='.repeat(60))
  console.log('=== markdown_content ===')
  console.log(a?.markdown_content)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

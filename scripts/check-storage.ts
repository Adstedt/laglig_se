import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const amendment = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: '2025:57' },
  })
  console.log('storage_path:', amendment?.storage_path)
  console.log('original_url:', amendment?.original_url)
  await prisma.$disconnect()
}
main()

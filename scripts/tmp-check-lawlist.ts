import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  const item = await prisma.lawListItem.findUnique({
    where: { id: '0322f6dc-0db3-43a3-aedc-370ff16d8541' },
    include: { law_list: { select: { id: true, name: true } } },
  })
  console.log('Law list:', item?.law_list?.name)
  console.log('Law list ID:', item?.law_list?.id)
  await prisma.$disconnect()
}
main()

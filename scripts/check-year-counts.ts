import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  console.log('Amendment documents per year:')
  for (const year of [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]) {
    const count = await prisma.amendmentDocument.count({
      where: { sfs_number: { startsWith: `SFS ${year}:` } },
    })
    console.log(`  ${year}: ${count}`)
  }
  const total = await prisma.amendmentDocument.count()
  console.log(`  Total: ${total}`)
  await prisma.$disconnect()
}
main()

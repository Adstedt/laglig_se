import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const stats = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    _count: true,
  })

  const sectionCount = await prisma.sectionChange.count()
  const total = await prisma.amendmentDocument.count()
  const completed =
    stats.find((s) => s.parse_status === 'COMPLETED')?._count || 0

  console.log('Amendment Document Stats:')
  console.log('========================')
  stats.forEach((s) => console.log(`  ${s.parse_status}: ${s._count}`))
  console.log(`  Total: ${total}`)
  console.log(`  Section changes: ${sectionCount}`)
  console.log(`  Success rate: ${((completed / total) * 100).toFixed(2)}%`)

  // Check PENDING docs
  const pending = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'PENDING' },
    select: { sfs_number: true, full_text: true },
  })

  if (pending.length > 0) {
    console.log('\nPENDING documents:')
    pending.forEach((d) => {
      const hasText = d.full_text ? 'has text' : 'NO TEXT'
      console.log(`  ${d.sfs_number} - ${hasText}`)
    })
  }

  await prisma.$disconnect()
}
main()

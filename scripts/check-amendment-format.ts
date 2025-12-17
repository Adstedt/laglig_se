import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking amendment document formats...\n')

  // Get sample amendments
  const samples = await prisma.amendmentDocument.findMany({
    select: { sfs_number: true, base_law_sfs: true },
    take: 10,
  })

  console.log('Sample base_law_sfs values:')
  for (const s of samples) {
    console.log(`  base: "${s.base_law_sfs}" | amendment: "${s.sfs_number}"`)
  }

  // Find amendments to arbetsmiljölagen
  const amlAmendments = await prisma.amendmentDocument.findMany({
    where: {
      OR: [
        { base_law_sfs: '1977:1160' },
        { base_law_sfs: 'SFS 1977:1160' },
        { base_law_sfs: { contains: '1977:1160' } },
      ],
    },
    select: { sfs_number: true, base_law_sfs: true },
    take: 5,
  })

  console.log('\nAmendments to arbetsmiljölagen (1977:1160):')
  console.log(`Found: ${amlAmendments.length}`)
  for (const a of amlAmendments) {
    console.log(`  ${a.base_law_sfs} -> ${a.sfs_number}`)
  }

  // Count total amendments
  const total = await prisma.amendmentDocument.count()
  console.log(`\nTotal amendments in DB: ${total}`)

  // Get distinct base_law_sfs formats
  const distinctBases = await prisma.amendmentDocument.findMany({
    distinct: ['base_law_sfs'],
    select: { base_law_sfs: true },
    take: 20,
  })

  console.log('\nSample distinct base_law_sfs values:')
  for (const d of distinctBases) {
    console.log(`  "${d.base_law_sfs}"`)
  }

  await prisma.$disconnect()
}

main()

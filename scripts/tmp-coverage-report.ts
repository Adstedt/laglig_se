import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const allDocs = await prisma.legalDocument.findMany({
    where: { document_number: { startsWith: 'SFS 2026:' } },
    select: { document_number: true, content_type: true },
  })

  const allAmendments = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { startsWith: '2026:' } },
    select: { sfs_number: true, parse_status: true },
  })

  const legalDocNums = new Set(
    allDocs.map((d) => d.document_number.replace('SFS ', ''))
  )
  const legalDocTypes = new Map(
    allDocs.map((d) => [d.document_number.replace('SFS ', ''), d.content_type])
  )
  const amendmentNums = new Map(
    allAmendments.map((a) => [a.sfs_number, a.parse_status])
  )

  console.log('SFS 2026:1 through 2026:89 — coverage report:\n')

  let laws = 0
  let amendments = 0
  let missing = 0
  const missingList: string[] = []

  for (let i = 1; i <= 89; i++) {
    const sfs = `2026:${i}`
    const hasLegal = legalDocNums.has(sfs)
    const legalType = legalDocTypes.get(sfs)
    const amendStatus = amendmentNums.get(sfs)

    let status: string
    if (hasLegal && legalType === 'SFS_AMENDMENT') {
      status = `Amendment [${amendStatus ?? 'no AmendDoc'}]`
      amendments++
    } else if (hasLegal && legalType === 'SFS_LAW') {
      status = `Law`
      laws++
    } else if (hasLegal) {
      status = `${legalType}`
    } else if (amendStatus) {
      status = `AmendDoc only [${amendStatus}] — NOT in LegalDocument!`
    } else {
      status = `MISSING`
      missing++
      missingList.push(sfs)
    }

    console.log(`  ${sfs.padEnd(10)} ${status}`)
  }

  console.log(`\n=== Summary ===`)
  console.log(`Laws (SFS_LAW): ${laws}`)
  console.log(`Amendments (SFS_AMENDMENT): ${amendments}`)
  console.log(`Missing entirely: ${missing}`)
  if (missingList.length) console.log(`Missing: ${missingList.join(', ')}`)

  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})

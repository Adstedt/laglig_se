import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // All 2026 AmendmentDocuments
  const amendments = await prisma.amendmentDocument.findMany({
    where: { sfs_number: { startsWith: '2026:' } },
    select: { sfs_number: true, parse_status: true },
  })
  const amendmentNums = new Set(
    amendments.map((a) => parseInt(a.sfs_number.split(':')[1] ?? '0'))
  )

  // All 2026 LegalDocuments (any type — laws, amendments, etc.)
  const legalDocs = await prisma.legalDocument.findMany({
    where: { document_number: { startsWith: 'SFS 2026:' } },
    select: { document_number: true, content_type: true, title: true },
  })
  const legalDocMap = new Map(
    legalDocs.map((d) => [
      parseInt(d.document_number.replace('SFS 2026:', '')),
      d,
    ])
  )

  console.log('=== What ACTUALLY needs work (SFS 2026:1-79) ===\n')

  const needsRetry: string[] = []
  const needsDiscover: number[] = []
  const newLawsOk: number[] = []
  const fullyDone: string[] = []

  for (let i = 1; i <= 79; i++) {
    const sfs = `2026:${i}`
    const hasAmendment = amendmentNums.has(i)
    const amd = amendments.find((a) => a.sfs_number === sfs)
    const ld = legalDocMap.get(i)

    if (hasAmendment && amd?.parse_status === 'COMPLETED') {
      fullyDone.push(sfs)
    } else if (hasAmendment && amd?.parse_status === 'FAILED') {
      needsRetry.push(sfs)
    } else if (!hasAmendment && ld?.content_type === 'SFS_LAW') {
      newLawsOk.push(i)
    } else if (!hasAmendment) {
      needsDiscover.push(i)
    }
  }

  console.log(`COMPLETED amendments (done):      ${fullyDone.length}`)
  fullyDone.forEach((s) => console.log(`  ${s}`))

  console.log(`\nFAILED amendments (need retry):   ${needsRetry.length}`)
  console.log(`  ${needsRetry.join(', ')}`)

  console.log(`\nNew laws already ingested (OK):    ${newLawsOk.length}`)
  newLawsOk.forEach((n) => {
    const ld = legalDocMap.get(n)
    console.log(`  2026:${n} — ${ld?.title?.slice(0, 70)}`)
  })

  console.log(`\nTruly missing (need discover):     ${needsDiscover.length}`)
  needsDiscover.forEach((n) => console.log(`  2026:${n}`))

  console.log('\n' + '='.repeat(50))
  console.log(
    `Total work: ${needsRetry.length} retries + ${needsDiscover.length} discovers`
  )
  console.log(
    `Estimated LLM calls: ${needsRetry.length + needsDiscover.length}`
  )

  await prisma.$disconnect()
}

main()

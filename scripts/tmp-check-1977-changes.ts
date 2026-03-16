import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // 1. Find the document
  const doc = await p.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { id: true, title: true },
  })
  console.log('Document:', JSON.stringify(doc))

  // 2. Change events linked to this document
  const changes = await p.changeEvent.findMany({
    where: { document_id: doc!.id },
    select: {
      id: true,
      change_type: true,
      amendment_sfs: true,
      detected_at: true,
    },
    orderBy: { detected_at: 'desc' },
    take: 10,
  })
  console.log(`\nChangeEvents for document_id ${doc!.id}: ${changes.length}`)
  for (const c of changes) {
    console.log(
      `  ${c.change_type} | ${c.amendment_sfs} | ${c.detected_at.toISOString().slice(0, 10)} | ${c.id}`
    )
  }

  // 3. Amendment documents referencing this base law
  const amendments = await p.amendmentDocument.findMany({
    where: { base_law_sfs: '1977:1160' },
    select: { id: true, sfs_number: true, title: true },
    take: 10,
  })
  console.log(
    `\nAmendmentDocuments with base_law_sfs '1977:1160': ${amendments.length}`
  )
  for (const a of amendments) {
    console.log(`  ${a.sfs_number} — ${a.title?.substring(0, 80)}`)
  }

  // 4. Also try base_law_sfs = 'SFS 1977:1160' (with prefix)
  const amendments2 = await p.amendmentDocument.count({
    where: { base_law_sfs: 'SFS 1977:1160' },
  })
  console.log(
    `\nAmendmentDocuments with base_law_sfs 'SFS 1977:1160': ${amendments2}`
  )

  // 5. Section changes for found amendments
  if (amendments.length > 0) {
    const sc = await p.sectionChange.findMany({
      where: { amendment_id: { in: amendments.map((a) => a.id) } },
      select: {
        amendment_id: true,
        chapter: true,
        section: true,
        change_type: true,
      },
      take: 10,
    })
    console.log(`\nSectionChanges (first 10): ${sc.length}`)
    for (const s of sc) {
      console.log(`  ${s.change_type} | kap ${s.chapter} § ${s.section}`)
    }
  }

  await p.$disconnect()
}

main()

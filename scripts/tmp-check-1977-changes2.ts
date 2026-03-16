import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // Get amendment SFS numbers for 1977:1160
  const amendments = await p.amendmentDocument.findMany({
    where: { base_law_sfs: 'SFS 1977:1160' },
    select: { id: true, sfs_number: true },
    orderBy: { sfs_number: 'desc' },
    take: 5,
  })
  console.log('Latest amendments to SFS 1977:1160:')
  for (const a of amendments) console.log(`  ${a.sfs_number}`)

  // Check if change events reference these amendment SFS numbers
  const sfsNumbers = amendments.map((a) => a.sfs_number)
  const changeEvents = await p.changeEvent.findMany({
    where: { amendment_sfs: { in: sfsNumbers } },
    select: {
      id: true,
      amendment_sfs: true,
      change_type: true,
      document_id: true,
    },
  })
  console.log(`\nChangeEvents referencing these: ${changeEvents.length}`)
  for (const c of changeEvents)
    console.log(
      `  ${c.amendment_sfs} | ${c.change_type} | doc: ${c.document_id}`
    )

  // Check section changes for first amendment
  const firstAmendment = amendments[0]
  if (firstAmendment) {
    const sc = await p.sectionChange.findMany({
      where: { amendment_id: firstAmendment.id },
      select: {
        chapter: true,
        section: true,
        change_type: true,
        description: true,
      },
      take: 5,
    })
    console.log(
      `\nSectionChanges for ${firstAmendment.sfs_number}: ${sc.length}`
    )
    for (const s of sc) {
      console.log(
        `  ${s.change_type} kap ${s.chapter} § ${s.section}: ${s.description?.substring(0, 80)}`
      )
    }

    // Test get_change_details with a matching change event if found
    if (changeEvents.length > 0) {
      const { createAgentTools } = await import('../lib/agent/tools')
      const tools = createAgentTools('default')
      console.log(
        `\n=== get_change_details for ${changeEvents[0].amendment_sfs} ===`
      )
      const result = await tools.get_change_details.execute(
        { changeEventId: changeEvents[0].id },
        { toolCallId: 'test', messages: [], abortSignal: undefined as any }
      )
      console.log(JSON.stringify(result, null, 2))
    }
  }

  await p.$disconnect()
}

main()

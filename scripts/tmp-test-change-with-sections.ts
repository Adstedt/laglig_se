import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // Find a change event whose amendment_sfs has SectionChanges
  const changeEvents = await p.changeEvent.findMany({
    where: { amendment_sfs: { not: null } },
    select: { id: true, amendment_sfs: true, change_type: true },
    orderBy: { detected_at: 'desc' },
    take: 100,
  })

  for (const ce of changeEvents) {
    const amendDoc = await p.amendmentDocument.findFirst({
      where: { sfs_number: ce.amendment_sfs! },
      select: { id: true },
    })
    if (!amendDoc) continue

    const scCount = await p.sectionChange.count({
      where: { amendment_id: amendDoc.id },
    })
    if (scCount > 0) {
      console.log(`Found: ChangeEvent ${ce.id}`)
      console.log(
        `  amendment_sfs: ${ce.amendment_sfs}, change_type: ${ce.change_type}`
      )
      console.log(`  SectionChanges: ${scCount}`)

      // Now test the tool
      const { createAgentTools } = await import('../lib/agent/tools')
      const tools = createAgentTools('default')
      const result = await tools.get_change_details.execute(
        { changeEventId: ce.id },
        { toolCallId: 'test', messages: [], abortSignal: undefined as any }
      )
      console.log('\n=== get_change_details result ===')
      console.log(JSON.stringify(result, null, 2))
      break
    }
  }

  await p.$disconnect()
}

main()

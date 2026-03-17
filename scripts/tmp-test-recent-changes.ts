import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
import { createAgentTools } from '../lib/agent/tools'

const p = new PrismaClient()
const tools = createAgentTools('default')
const ctx = { toolCallId: 'test', messages: [], abortSignal: undefined as any }

async function main() {
  // Find a change event that has matching amendment + section changes
  console.log('=== Finding change event with full data chain ===')
  const events = await p.changeEvent.findMany({
    where: { amendment_sfs: { not: null } },
    include: { document: { select: { title: true, document_number: true } } },
    orderBy: { detected_at: 'desc' },
    take: 50,
  })

  let targetEvent = null
  for (const ev of events) {
    const amendDoc = await p.amendmentDocument.findFirst({
      where: { sfs_number: ev.amendment_sfs! },
      select: { id: true },
    })
    if (!amendDoc) continue
    const scCount = await p.sectionChange.count({
      where: { amendment_id: amendDoc.id },
    })
    if (scCount > 0) {
      targetEvent = { ...ev, sectionChangeCount: scCount }
      break
    }
  }

  if (!targetEvent) {
    console.log('No change event with full data chain found')
    await p.$disconnect()
    return
  }

  console.log(
    `\nTarget: ${targetEvent.document.document_number} — ${targetEvent.document.title}`
  )
  console.log(`  ChangeEvent: ${targetEvent.id}`)
  console.log(`  Amendment: ${targetEvent.amendment_sfs}`)
  console.log(`  Type: ${targetEvent.change_type}`)
  console.log(
    `  Detected: ${targetEvent.detected_at.toISOString().slice(0, 10)}`
  )
  console.log(`  SectionChanges: ${targetEvent.sectionChangeCount}`)

  // 1. Search for the law
  const lawTitle = targetEvent.document
    .title!.replace(/\n/g, ' ')
    .substring(0, 50)
  console.log(`\n=== 1. search_laws: "${lawTitle}" ===`)
  const r1 = await tools.search_laws.execute({ query: lawTitle, limit: 3 }, ctx)
  if (r1 && typeof r1 === 'object' && 'data' in r1) {
    for (const d of (r1 as any).data) {
      console.log(
        `  [${d.relevanceScore}] ${d.documentNumber} — ${d.contextualHeader.substring(0, 100)}`
      )
    }
  }

  // 2. Get document details
  console.log(
    `\n=== 2. get_document_details: ${targetEvent.document.document_number} ===`
  )
  const r2 = await tools.get_document_details.execute(
    { documentNumber: targetEvent.document.document_number },
    ctx
  )
  if (r2 && typeof r2 === 'object' && 'data' in r2) {
    const d = (r2 as any).data
    console.log(`  title: ${d.title}`)
    console.log(`  status: ${d.status}`)
    console.log(`  summary: ${d.summary?.substring(0, 150)}...`)
    console.log(`  markdown: ${d.markdownContent?.length ?? 0} chars`)
  }

  // 3. Get change details — the main test
  console.log(`\n=== 3. get_change_details: ${targetEvent.amendment_sfs} ===`)
  const r3 = await tools.get_change_details.execute(
    { changeEventId: targetEvent.id },
    ctx
  )
  console.log(JSON.stringify(r3, null, 2))

  await p.$disconnect()
}

main()

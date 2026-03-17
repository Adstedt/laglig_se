/**
 * Focused tests around SFS 1977:1160 (Arbetsmiljölagen)
 * Run: npx tsx scripts/tmp-test-1977-1160.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAgentTools } from '../lib/agent/tools'
import { PrismaClient } from '@prisma/client'

const tools = createAgentTools('default')
const prisma = new PrismaClient()

const ctx = { toolCallId: 'test', messages: [], abortSignal: undefined as any }

async function main() {
  // 1. Search for topics covered by Arbetsmiljölagen
  console.log('\n=== 1. Search: "skyddsombud arbetsplats" ===')
  const r1 = await tools.search_laws.execute(
    { query: 'skyddsombud arbetsplats', limit: 5 },
    ctx
  )
  printCompact(r1)

  // 2. Search specifically for SFS laws about arbetsmiljö
  console.log(
    '\n=== 2. Search: "systematiskt arbetsmiljöarbete" (SFS_LAW only) ==='
  )
  const r2 = await tools.search_laws.execute(
    {
      query: 'systematiskt arbetsmiljöarbete',
      contentType: 'SFS_LAW',
      limit: 5,
    },
    ctx
  )
  printCompact(r2)

  // 3. Look up 1977:1160 by document number
  console.log('\n=== 3. get_document_details: SFS 1977:1160 ===')
  const r3 = await tools.get_document_details.execute(
    { documentNumber: 'SFS 1977:1160' },
    ctx
  )
  if (r3 && typeof r3 === 'object' && 'data' in r3) {
    const d = (r3 as any).data
    console.log('  title:', d.title)
    console.log('  status:', d.status)
    console.log('  contentType:', d.contentType)
    console.log('  path:', d.path)
    console.log('  summary length:', d.summary?.length, 'chars')
    console.log('  kommentar length:', d.kommentar?.length, 'chars')
    console.log('  markdown length:', d.markdownContent?.length, 'chars')
    console.log('  _meta:', (r3 as any)._meta)
  }

  // 4. Look up by ID (using the ID we got from step 3)
  console.log('\n=== 4. get_document_details: by ID ===')
  const docId = (r3 as any)?.data?.id
  if (docId) {
    const r4 = await tools.get_document_details.execute(
      { documentId: docId },
      ctx
    )
    const d4 = (r4 as any)?.data
    console.log(
      '  Lookup by ID matches:',
      d4?.documentNumber === 'SFS 1977:1160' ? 'YES' : 'NO'
    )
    console.log('  title:', d4?.title)
  }

  // 5. Find change events for 1977:1160
  console.log('\n=== 5. Change events for SFS 1977:1160 ===')
  const changes = await prisma.changeEvent.findMany({
    where: { document: { document_number: 'SFS 1977:1160' } },
    select: {
      id: true,
      change_type: true,
      amendment_sfs: true,
      detected_at: true,
    },
    orderBy: { detected_at: 'desc' },
    take: 5,
  })
  console.log(`  Found ${changes.length} change events`)
  for (const c of changes) {
    console.log(
      `  - ${c.change_type} via ${c.amendment_sfs} (${c.detected_at.toISOString().slice(0, 10)})`
    )
  }

  // 6. If there's a change event, test get_change_details with it
  if (changes.length > 0) {
    console.log(
      `\n=== 6. get_change_details for ${changes[0].amendment_sfs} ===`
    )
    const r6 = await tools.get_change_details.execute(
      { changeEventId: changes[0].id },
      ctx
    )
    console.log(JSON.stringify(r6, null, 2))
  } else {
    console.log('\n=== 6. SKIPPED — no change events for 1977:1160 ===')
  }

  await prisma.$disconnect()
  process.exit(0)
}

function printCompact(result: any) {
  if (result?.error) {
    console.log('  ERROR:', result.message)
    return
  }
  const data = result?.data
  if (Array.isArray(data)) {
    for (const d of data) {
      console.log(
        `  [${d.relevanceScore}] ${d.documentNumber} — ${d.contextualHeader}`
      )
      console.log(`    ${d.snippet.substring(0, 120)}...`)
    }
  }
  console.log('  _meta:', result?._meta)
}

main()

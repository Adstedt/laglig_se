/**
 * Simulates agent tool use → response generation for a realistic user query.
 * Run: npx tsx scripts/tmp-simulate-agent.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAgentTools } from '../lib/agent/tools'

const tools = createAgentTools('default')
const ctx = { toolCallId: 'test', messages: [], abortSignal: undefined as any }

// ---------------------------------------------------------------------------
// Simulate: "Vilka krav ställs på arbetsgivaren kring kemikaliehantering?"
// ---------------------------------------------------------------------------

async function simulate() {
  const userQuery =
    'Vilka krav ställs på arbetsgivaren kring kemikaliehantering?'
  console.log(`\n👤 Användare: ${userQuery}`)
  console.log('─'.repeat(70))

  // Step 1: Agent decides to search
  console.log('\n🔧 [Tool call: search_laws]')
  const searchResult = await tools.search_laws.execute(
    { query: 'arbetsgivarens krav kemikaliehantering', limit: 5 },
    ctx
  )

  const searchData = (searchResult as any).data
  const searchMeta = (searchResult as any)._meta
  console.log(
    `   → ${searchMeta.resultCount} results in ${searchMeta.executionTimeMs}ms`
  )

  // Step 2: Agent picks the most relevant document to get full details
  const topDoc = searchData[0]
  console.log(
    `\n🔧 [Tool call: get_document_details "${topDoc.documentNumber}"]`
  )
  const docResult = await tools.get_document_details.execute(
    { documentNumber: topDoc.documentNumber },
    ctx
  )

  const docData = (docResult as any).data
  const docMeta = (docResult as any)._meta
  console.log(`   → ${docData.title} (${docMeta.executionTimeMs}ms)`)

  // Step 3: Agent composes response using tool results
  console.log('\n' + '─'.repeat(70))
  console.log('🤖 Agent svarar:\n')

  const response = composeResponse(userQuery, searchData, docData)
  console.log(response)
}

function composeResponse(
  query: string,
  searchResults: any[],
  detailedDoc: any
): string {
  // Group results by document
  const byDoc = new Map<string, any[]>()
  for (const r of searchResults) {
    const key = r.documentNumber
    if (!byDoc.has(key)) byDoc.set(key, [])
    byDoc.get(key)!.push(r)
  }

  let msg = `## Krav på arbetsgivaren kring kemikaliehantering\n\n`
  msg += `Baserat på gällande lagstiftning finns det flera krav som ställs på arbetsgivaren. `
  msg += `Här är de mest relevanta bestämmelserna:\n\n`

  for (const [docNumber, results] of byDoc) {
    msg += `### ${docNumber}\n\n`
    for (const r of results) {
      const header =
        r.contextualHeader.split('>').pop()?.trim() || r.contextualHeader
      msg += `**${header}** — `
      // Clean up snippet
      const snippet = r.snippet.split('\n')[0].trim()
      msg += `${snippet}\n\n`
    }
  }

  if (detailedDoc.kommentar) {
    msg += `### Vad innebär detta i praktiken?\n\n`
    msg += `${detailedDoc.kommentar.substring(0, 500)}\n\n`
  }

  msg += `---\n`
  msg += `*Källor: ${[...byDoc.keys()].join(', ')}*\n`
  msg += `*Läs mer: [${detailedDoc.title?.trim()}](${detailedDoc.path})*`

  return msg
}

simulate().then(() => process.exit(0))

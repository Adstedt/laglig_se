/**
 * Quick interactive test for 14.7a agent tools.
 * Run: npx tsx scripts/tmp-test-agent-tools.ts
 *
 * Tests each tool against the real database to see actual output.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { createAgentTools } from '../lib/agent/tools'

const tools = createAgentTools('default')

async function testSearchLaws() {
  console.log('\n=== search_laws ===')
  const result = await tools.search_laws.execute(
    { query: 'arbetsgivarens skyldigheter för skyddsutrustning', limit: 3 },
    { toolCallId: 'test-1', messages: [], abortSignal: undefined as any }
  )
  console.log(JSON.stringify(result, null, 2))
}

async function testSearchLawsFiltered() {
  console.log('\n=== search_laws (filtered: AGENCY_REGULATION) ===')
  const result = await tools.search_laws.execute(
    { query: 'kemikaliehantering', contentType: 'AGENCY_REGULATION', limit: 3 },
    { toolCallId: 'test-2', messages: [], abortSignal: undefined as any }
  )
  console.log(JSON.stringify(result, null, 2))
}

async function testGetDocumentDetails() {
  console.log('\n=== get_document_details (by number) ===')
  const result = await tools.get_document_details.execute(
    { documentNumber: 'SFS 1977:1160' },
    { toolCallId: 'test-3', messages: [], abortSignal: undefined as any }
  )
  // Truncate markdownContent for readability
  if (result && typeof result === 'object' && 'data' in result) {
    const data = (result as any).data
    if (data?.markdownContent) {
      data.markdownContent =
        data.markdownContent.substring(0, 500) + '... [truncated]'
    }
  }
  console.log(JSON.stringify(result, null, 2))
}

async function testGetDocumentDetailsNotFound() {
  console.log('\n=== get_document_details (not found) ===')
  const result = await tools.get_document_details.execute(
    { documentNumber: 'SFS 9999:9999' },
    { toolCallId: 'test-4', messages: [], abortSignal: undefined as any }
  )
  console.log(JSON.stringify(result, null, 2))
}

async function testGetDocumentDetailsMissingParams() {
  console.log('\n=== get_document_details (no params — error) ===')
  const result = await tools.get_document_details.execute(
    {},
    { toolCallId: 'test-5', messages: [], abortSignal: undefined as any }
  )
  console.log(JSON.stringify(result, null, 2))
}

async function main() {
  try {
    await testSearchLaws()
    await testSearchLawsFiltered()
    await testGetDocumentDetails()
    await testGetDocumentDetailsNotFound()
    await testGetDocumentDetailsMissingParams()

    // get_change_details — real event
    console.log('\n=== get_change_details ===')
    const changeResult = await tools.get_change_details.execute(
      { changeEventId: 'cmmh40nyb002jl704rafyd5xe' },
      { toolCallId: 'test-6', messages: [], abortSignal: undefined as any }
    )
    console.log(JSON.stringify(changeResult, null, 2))

    // get_change_details — not found
    console.log('\n=== get_change_details (not found) ===')
    const changeNotFound = await tools.get_change_details.execute(
      { changeEventId: 'nonexistent-id' },
      { toolCallId: 'test-7', messages: [], abortSignal: undefined as any }
    )
    console.log(JSON.stringify(changeNotFound, null, 2))
  } catch (err) {
    console.error('Fatal error:', err)
  } finally {
    process.exit(0)
  }
}

main()

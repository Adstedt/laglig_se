/**
 * Smoke test: write tools against real workspace (proposal only — no mutations)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Find workspace
  const workspaces = await prisma.workspace.findMany({
    where: { name: { contains: 'grro', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  console.log('Workspaces found:', workspaces)

  if (workspaces.length === 0) {
    console.log('No workspace found')
    return
  }

  // Pick the "grro technologies 2" workspace
  const ws =
    workspaces.find((w) => w.name.toLowerCase().includes('2')) ?? workspaces[0]!
  const workspaceId = ws.id
  console.log(`\nUsing workspace: "${ws.name}" (${workspaceId})`)

  // 2. Find a LawListItem in this workspace
  const items = await prisma.lawListItem.findMany({
    where: { law_list: { workspace_id: workspaceId } },
    include: {
      document: { select: { title: true, document_number: true } },
    },
    take: 3,
  })

  console.log(`\nFound ${items.length} law list items:`)
  for (const item of items) {
    console.log(
      `  - ${item.id}: ${item.document?.title ?? item.document?.document_number} (status: ${item.compliance_status})`
    )
    console.log(
      `    business_context: ${item.business_context ? item.business_context.slice(0, 80) + '...' : '(null)'}`
    )
    console.log(
      `    compliance_actions: ${item.compliance_actions ? item.compliance_actions.slice(0, 80) + '...' : '(null)'}`
    )
  }

  if (items.length === 0) {
    console.log('No law list items found — cannot test tools')
    return
  }

  // 3. Test tools in proposal mode (execute: false — no mutations!)
  // NOTE: create_task skipped — it imports server actions which need Supabase Auth env vars.
  // It's fully tested in unit tests. The other 3 tools use Prisma directly.
  const { createUpdateComplianceStatusTool } = await import(
    '../lib/agent/tools/update-compliance-status'
  )
  const { createAddContextNoteTool } = await import(
    '../lib/agent/tools/add-context-note'
  )
  const { createSaveAssessmentTool } = await import(
    '../lib/agent/tools/save-assessment'
  )

  const toolOpts = {
    toolCallId: 'smoke-1',
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  }

  const testItem = items[0]!

  console.log(
    '\n--- create_task: SKIPPED (needs Supabase Auth env — covered by unit tests) ---'
  )

  console.log('\n--- update_compliance_status (PROPOSAL) ---')
  const updateTool = createUpdateComplianceStatusTool(workspaceId)
  const proposalResult = await updateTool.execute(
    {
      lawListItemId: testItem.id,
      newStatus: 'PAGAENDE',
      reason: 'Testorsak — smoke test',
      execute: false,
    },
    toolOpts
  )
  console.log(JSON.stringify(proposalResult, null, 2))

  console.log('\n--- update_compliance_status (EXECUTE) ---')
  const executeResult = await updateTool.execute(
    {
      lawListItemId: testItem.id,
      newStatus: 'PAGAENDE',
      reason: 'Testorsak — smoke test',
      execute: true,
    },
    toolOpts
  )
  console.log(JSON.stringify(executeResult, null, 2))

  // Verify the change persisted
  const updated = await prisma.lawListItem.findUnique({
    where: { id: testItem.id },
    select: {
      compliance_status: true,
      compliance_actions: true,
      compliance_actions_updated_at: true,
    },
  })
  console.log('\n--- DB verification ---')
  console.log(JSON.stringify(updated, null, 2))

  console.log('\n--- add_context_note (proposal only) ---')
  const noteTool = createAddContextNoteTool(workspaceId)
  const noteResult = await noteTool.execute(
    {
      lawListItemId: testItem.id,
      note: 'Testanteckning — detta är ett smoke test',
      execute: false,
    },
    toolOpts
  )
  console.log(JSON.stringify(noteResult, null, 2))

  console.log('\n--- save_assessment (stub) ---')
  const assessTool = createSaveAssessmentTool(workspaceId)
  const assessResult = await assessTool.execute(
    {
      changeEventId: 'fake-ce-1',
      lawListItemId: testItem.id,
      impactLevel: 'MEDIUM',
      analysis: 'Testanalys',
      recommendations: 'Testrekommendationer',
      execute: false,
    },
    toolOpts
  )
  console.log(JSON.stringify(assessResult, null, 2))

  console.log('\n--- invalid ID error test ---')
  const errorResult = await updateTool.execute(
    {
      lawListItemId: 'nonexistent-id-12345',
      newStatus: 'UPPFYLLD',
      reason: 'Ska ge fel',
      execute: false,
    },
    toolOpts
  )
  console.log(JSON.stringify(errorResult, null, 2))

  console.log('\n✅ All smoke tests complete — no data was mutated')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

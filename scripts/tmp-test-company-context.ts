/**
 * Quick manual test: get_company_context tool against Grro Technologies 2
 */
import { prisma } from '../lib/prisma'
import { createGetCompanyContextTool } from '../lib/agent/tools/get-company-context'

async function main() {
  // Find workspace
  const workspaces = await prisma.workspace.findMany({
    where: { name: { contains: 'Grro' } },
    select: { id: true, name: true },
  })
  console.log('Found workspaces:', workspaces)

  if (workspaces.length === 0) {
    console.error('No Grro workspace found')
    process.exit(1)
  }

  // Pick the one with "2" if multiple
  const ws = workspaces.find((w) => w.name.includes('2')) ?? workspaces[0]!
  console.log(`\nUsing workspace: ${ws.name} (${ws.id})\n`)

  // Create and execute tool
  const tool = createGetCompanyContextTool(ws.id)
  const result = await tool.execute(
    {},
    {
      toolCallId: 'test-1',
      messages: [],
      abortSignal: undefined as unknown as AbortSignal,
    }
  )

  console.log(JSON.stringify(result, null, 2))

  await prisma.$disconnect()
}

main().catch(console.error)

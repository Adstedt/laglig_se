/**
 * Reset acknowledgements for Grro Technologies workspace
 * so unacknowledged changes appear again for testing.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find Grro workspace
  const ws = await prisma.workspace.findFirst({
    where: { name: { contains: 'Grro', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!ws) {
    console.log('No Grro workspace found')
    return
  }
  console.log('Workspace:', ws.name, ws.id)

  // Find acknowledged law list items
  const items = await prisma.lawListItem.findMany({
    where: {
      law_list: { workspace_id: ws.id },
      last_change_acknowledged_at: { not: null },
    },
    select: {
      id: true,
      last_change_acknowledged_at: true,
      document: { select: { title: true, document_number: true } },
    },
  })
  console.log(`\nFound ${items.length} acknowledged items:`)
  for (const item of items) {
    console.log(
      ` - ${item.document?.title?.slice(0, 60)} (${item.document?.document_number})`
    )
  }

  // Delete assessments for this workspace
  const deletedAssessments = await prisma.changeAssessment.deleteMany({
    where: { workspace_id: ws.id },
  })
  console.log(`\nDeleted ${deletedAssessments.count} assessments`)

  // Reset acknowledgement timestamps
  const updated = await prisma.lawListItem.updateMany({
    where: {
      law_list: { workspace_id: ws.id },
      last_change_acknowledged_at: { not: null },
    },
    data: {
      last_change_acknowledged_at: null,
      last_change_acknowledged_by: null,
    },
  })
  console.log(`Reset ${updated.count} law list items`)

  // Also clear any change-context chat history so assessment starts fresh
  const deletedChats = await prisma.chatMessage.deleteMany({
    where: {
      workspace_id: ws.id,
      context_type: 'CHANGE',
    },
  })
  console.log(`Deleted ${deletedChats.count} change-context chat messages`)

  console.log('\nDone! Refresh the page to see unacknowledged changes.')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })

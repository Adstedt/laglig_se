import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Find Test 511 cycle.
  const cycle = await prisma.complianceAuditCycle.findFirst({
    where: { name: 'Test 511' },
    select: { id: true, status: true, workspace_id: true },
  })
  if (!cycle) throw new Error('Test 511 cycle not found')
  console.log('Test 511 cycle:', cycle.id, 'status:', cycle.status)

  // 2. Walk cycle.items → lawListItem → all three doc-evidence pathways,
  //    pick ANY linked WorkspaceDocument (prefer a non-DEMO one for realism).
  const items = await prisma.complianceAuditItem.findMany({
    where: { cycle_id: cycle.id },
    select: {
      law_list_item: {
        select: {
          workspace_document_links: {
            select: {
              document: { select: { id: true, title: true, status: true } },
            },
          },
          requirements: {
            select: {
              evidence_links: {
                select: {
                  workspace_document: {
                    select: { id: true, title: true, status: true },
                  },
                },
              },
            },
          },
          task_links: {
            select: {
              task: {
                select: {
                  workspace_document_links: {
                    select: {
                      document: {
                        select: { id: true, title: true, status: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const docs = new Map<
    string,
    { id: string; title: string; status: string; pathway: string }
  >()
  for (const item of items) {
    for (const l of item.law_list_item.workspace_document_links) {
      if (l.document)
        docs.set(l.document.id, { ...l.document, pathway: 'direct' })
    }
    for (const req of item.law_list_item.requirements) {
      for (const ev of req.evidence_links) {
        if (ev.workspace_document)
          docs.set(ev.workspace_document.id, {
            ...ev.workspace_document,
            pathway: 'kravpunkt-bevis',
          })
      }
    }
    for (const tl of item.law_list_item.task_links) {
      for (const dl of tl.task.workspace_document_links) {
        if (dl.document)
          docs.set(dl.document.id, { ...dl.document, pathway: 'task-bridged' })
      }
    }
  }
  const allDocs = Array.from(docs.values())
  console.log(
    `\nFound ${allDocs.length} WorkspaceDocument(s) linked to Test 511:`
  )
  console.table(allDocs)

  if (allDocs.length === 0) {
    console.log(
      '\n⚠️  Test 511 has NO WorkspaceDocument evidence linked via any of the 3 pathways.'
    )
    console.log(
      '   DRAFT panel cannot be exercised on this cycle without linking a doc first.'
    )
    return
  }

  // 3. Pick the first APPROVED doc and flip it to DRAFT.
  const target = allDocs.find((d) => d.status === 'APPROVED') ?? allDocs[0]
  if (!target) return
  console.log(
    `\nFlipping "${target.title}" (${target.id}) status ${target.status} → DRAFT`
  )
  const updated = await prisma.workspaceDocument.update({
    where: { id: target.id },
    data: { status: 'DRAFT' },
  })
  console.log('Done. New status:', updated.status)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

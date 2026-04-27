import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Revert my accidental flip on Test 511's evidence.
  await prisma.workspaceDocument.update({
    where: { id: '511b7c38-2b07-4a3d-a750-07f5146af333' },
    data: { status: 'APPROVED' },
  })
  console.log(
    'Reverted "DEMO styrdokument — Approved för seal" back to APPROVED.'
  )

  // 2. Find the AVSLUTAD (not sealed, not pågående) "Test" cycle.
  const cycle = await prisma.complianceAuditCycle.findFirst({
    where: {
      workspace: { slug: 'almasa-havshotell-ab-fvarlj' },
      name: 'Test',
      status: 'AVSLUTAD',
      deleted_at: null,
    },
    select: { id: true, name: true, status: true },
  })
  if (!cycle) throw new Error('AVSLUTAD "Test" cycle not found')
  console.log('\nAVSLUTAD Test cycle:', cycle.id)

  // 3. Gather all linked WorkspaceDocuments across 3 pathways.
  const items = await prisma.complianceAuditItem.findMany({
    where: { cycle_id: cycle.id },
    select: {
      law_list_item: {
        select: {
          document: { select: { document_number: true, title: true } },
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
  console.log(`\nFound ${allDocs.length} doc(s) linked to "Test" (AVSLUTAD):`)
  console.table(allDocs)

  if (allDocs.length === 0) {
    console.log(
      '\nNo WorkspaceDocument evidence on "Test". Linking "DEMO styrdokument — Utkast — blockerar seal" (already DRAFT) to first item.'
    )
    const demoDraft = await prisma.workspaceDocument.findFirst({
      where: {
        title: 'DEMO styrdokument — Utkast — blockerar seal',
        workspace: { slug: 'almasa-havshotell-ab-fvarlj' },
      },
      select: { id: true, status: true },
    })
    if (!demoDraft) throw new Error('DEMO DRAFT doc not found')
    console.log('DEMO DRAFT doc:', demoDraft.id, 'status:', demoDraft.status)
    const firstItem = items[0]
    if (!firstItem) throw new Error('Test cycle has no items')
    const lliRow = await prisma.lawListItem.findFirst({
      where: { compliance_audit_items: { some: { cycle_id: cycle.id } } },
      select: { id: true },
    })
    if (!lliRow)
      throw new Error('Could not resolve lawListItemId for Test cycle')
    await prisma.workspaceDocumentListItemLink.create({
      data: {
        workspace_document_id: demoDraft.id,
        law_list_item_id: lliRow.id,
      },
    })
    console.log('Linked DEMO DRAFT doc to LawListItem', lliRow.id)
    return
  }

  // 4. Flip first APPROVED (or first anything) doc to DRAFT.
  const target = allDocs.find((d) => d.status === 'APPROVED') ?? allDocs[0]
  if (!target) return
  if (target.status === 'DRAFT') {
    console.log(`"${target.title}" is ALREADY DRAFT. Nothing to flip.`)
  } else {
    console.log(
      `\nFlipping "${target.title}" (${target.id}) status ${target.status} → DRAFT`
    )
    await prisma.workspaceDocument.update({
      where: { id: target.id },
      data: { status: 'DRAFT' },
    })
    console.log('Done.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

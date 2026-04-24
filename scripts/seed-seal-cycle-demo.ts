/**
 * Story 21.9 smoke-test helper.
 *
 * Promotes an existing workspace + laglista into a cycle primed for testing
 * the Fastställ kontroll flow. Idempotent: safe to run multiple times —
 * existing demo cycles get their state reset.
 *
 * Creates TWO cycles in the target workspace:
 *   1. "DEMO — Redo för fastställande"
 *      - Status: AVSLUTAD (ready to seal)
 *      - 3 items, all signed off
 *      - 1 open AVVIKELSE (override-gate test)
 *      - 1 closed AVVIKELSE
 *      - 1 OBSERVATION (does NOT block seal)
 *      - 1 APPROVED document-evidence attached to item #1
 *
 *   File evidence is intentionally NOT seeded — sealCycle hashes file
 *   bytes from Supabase Storage, and the seed has no way to upload real
 *   bytes from a Node script without auth complexity. Document evidence
 *   is hashed from DB rows (current_version content), so it works end-to-
 *   end without any Storage interaction. To exercise the file-deletion
 *   guard (T4 in the smoke-test doc), upload a real file via the /filer
 *   UI and link it to the cycle item before sealing.
 *
 *   2. "DEMO — Draft-dokument blockar"
 *      - Status: AVSLUTAD
 *      - 2 items, all signed off
 *      - No findings
 *      - 1 DRAFT-status styrdokument as evidence → INTEGRITY-001 reject path
 *
 * Usage:
 *   pnpm tsx scripts/seed-seal-cycle-demo.ts --workspace almasa-havshotell-ab-fvarlj
 *
 * After running, navigate to /laglistor/kontroller and click either demo
 * cycle to exercise the seal flow.
 */

import { PrismaClient, WorkspaceDocumentStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const workspaceSlug =
    process.argv.find((a) => a.startsWith('--workspace='))?.split('=')[1] ??
    process.argv[process.argv.indexOf('--workspace') + 1] ??
    'almasa-havshotell-ab-fvarlj'

  console.log(`🌱 Seeding seal-cycle demo in workspace "${workspaceSlug}"…`)

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  })
  if (!workspace) {
    throw new Error(
      `Workspace "${workspaceSlug}" not found — create it first via the onboarding wizard or run seed-test-workspace.ts.`
    )
  }

  const owner = await prisma.workspaceMember.findFirst({
    where: { workspace_id: workspace.id, role: 'OWNER' },
    include: { user: true },
  })
  if (!owner) {
    throw new Error(`No OWNER member found in workspace "${workspaceSlug}".`)
  }
  console.log(`  Owner: ${owner.user.email}`)

  const lawList = await prisma.lawList.findFirst({
    where: { workspace_id: workspace.id },
    include: { items: { take: 5 } },
  })
  if (!lawList || lawList.items.length < 5) {
    throw new Error(
      `Workspace "${workspaceSlug}" needs a laglista with at least 5 items so the two demo cycles can use DISJOINT item slices (cycle 1 uses items 0-2, cycle 2 uses items 3-4). Otherwise cycle 1 picks up cycle 2's DRAFT-doc evidence via the shared LawListItem and incorrectly fails the INTEGRITY-001 gate. Add documents via /laglistor first.`
    )
  }
  console.log(
    `  Laglista: "${lawList.name}" (${lawList.items.length} items available)`
  )

  // ── Reset: previous DEMO cycles + their seeded artifacts ───────────────
  // (1) Soft-delete prior DEMO cycles.
  await prisma.complianceAuditCycle.updateMany({
    where: {
      workspace_id: workspace.id,
      name: { startsWith: 'DEMO —' },
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  })

  // (2) Hard-delete prior seeded WorkspaceDocument rows so they don't
  //     accumulate as link duplicates on re-run. Cascades to versions +
  //     list-item links. Real user docs are untouched (different title prefix).
  const priorDemoDocs = await prisma.workspaceDocument.findMany({
    where: {
      workspace_id: workspace.id,
      title: { startsWith: 'DEMO styrdokument' },
    },
    select: { id: true, current_version_id: true },
  })
  for (const d of priorDemoDocs) {
    if (d.current_version_id) {
      await prisma.workspaceDocument.update({
        where: { id: d.id },
        data: { current_version_id: null },
      })
    }
  }
  await prisma.workspaceDocument.deleteMany({
    where: {
      workspace_id: workspace.id,
      title: { startsWith: 'DEMO styrdokument' },
    },
  })

  // (3) Hard-delete prior fake-storage WorkspaceFile rows. (Even though v2+
  //     of this seed stopped creating these, v1 may have left some behind.)
  await prisma.workspaceFile.deleteMany({
    where: {
      workspace_id: workspace.id,
      storage_path: { startsWith: 'demo/' },
    },
  })

  console.log(
    `  Cleared previous DEMO cycles + ${priorDemoDocs.length} demo styrdokument + any fake-storage files`
  )

  // ── Helper: seed a DRAFT + APPROVED WorkspaceDocument pair ────────────
  // Order matters for the FK: document → version (references document) →
  // update document.current_version_id to point at the version.
  async function seedStyrdokument(
    status: WorkspaceDocumentStatus,
    titleSuffix: string
  ) {
    const doc = await prisma.workspaceDocument.create({
      data: {
        workspace_id: workspace!.id,
        title: `DEMO styrdokument — ${titleSuffix}`,
        document_type: 'PROCEDURE',
        status,
        current_version_number: 1,
        created_by: owner.user_id,
        ...(status === 'APPROVED'
          ? { approved_by: owner.user_id, approved_at: new Date() }
          : {}),
      },
    })
    const version = await prisma.workspaceDocumentVersion.create({
      data: {
        document_id: doc.id,
        version_number: 1,
        content_json: { type: 'doc', content: [] },
        content_html: '<p>Demo styrdokument innehåll.</p>',
        extracted_text: 'Demo styrdokument innehåll.',
        created_by: owner.user_id,
      },
    })
    await prisma.workspaceDocument.update({
      where: { id: doc.id },
      data: { current_version_id: version.id },
    })
    return doc
  }

  const approvedDoc = await seedStyrdokument('APPROVED', 'Approved för seal')
  const draftDoc = await seedStyrdokument('DRAFT', 'Utkast — blockerar seal')
  console.log(
    `  Created styrdokument: APPROVED=${approvedDoc.id.slice(0, 8)}, DRAFT=${draftDoc.id.slice(0, 8)}`
  )

  // File evidence intentionally omitted — see header doc.

  // ── Cycle 1: Ready to seal (with mixed findings) ──────────────────────
  const itemsForCycle1 = lawList.items.slice(0, 3)
  const cycle1 = await prisma.complianceAuditCycle.create({
    data: {
      workspace_id: workspace.id,
      law_list_id: lawList.id,
      name: 'DEMO — Redo för fastställande',
      audit_type: 'INTERN',
      scheduled_start: new Date('2026-01-15T00:00:00Z'),
      scheduled_end: new Date('2026-03-31T00:00:00Z'),
      law_change_cutoff_date: new Date('2026-01-01T00:00:00Z'),
      lead_auditor_user_id: owner.user_id,
      created_by_user_id: owner.user_id,
      status: 'AVSLUTAD',
      scope_definition: { kind: 'all' },
    },
  })

  // Materialise + sign off items
  for (const [i, item] of itemsForCycle1.entries()) {
    await prisma.complianceAuditItem.create({
      data: {
        cycle_id: cycle1.id,
        law_list_item_id: item.id,
        efterlevnadsbedomning: i === 0 ? 'UPPFYLLD' : 'DELVIS',
        motivering: `Bedömning för dokument ${i + 1}.`,
        reviewed_at: new Date(),
        reviewed_by_user_id: owner.user_id,
        signed_off_at: new Date(),
        signed_off_by_user_id: owner.user_id,
      },
    })
  }

  // Attach the APPROVED styrdokument as evidence to item #1. Document
  // hash is computed from DB content, so no Storage interaction needed —
  // seal completes end-to-end in the seeded state.
  const firstItem = itemsForCycle1[0]!
  await prisma.workspaceDocumentListItemLink.create({
    data: {
      document_id: approvedDoc.id,
      list_item_id: firstItem.id,
      linked_by: owner.user_id,
    },
  })

  // Findings: 1 open AVVIKELSE, 1 closed AVVIKELSE, 1 OBSERVATION
  await prisma.complianceFinding.createMany({
    data: [
      {
        cycle_id: cycle1.id,
        law_list_item_id: firstItem.id,
        type: 'AVVIKELSE',
        severity: 'MINOR',
        title: 'Saknar dokumentation för rutin A',
        description: 'Rutinen hänvisas till men finns inte skriftligt.',
      },
      {
        cycle_id: cycle1.id,
        type: 'AVVIKELSE',
        severity: 'MAJOR',
        title: 'Avvikelse åtgärdad innan seal',
        description: 'Stängd avvikelse — testar att stängda inte blockerar.',
        closed_at: new Date(),
        closed_by_user_id: owner.user_id,
      },
      {
        cycle_id: cycle1.id,
        type: 'OBSERVATION',
        title: 'Förbättringsmöjlighet vid riskbedömning',
        description: 'Observation — ska INTE blockera seal.',
      },
    ],
  })

  console.log(
    `  ✓ Cycle 1 "${cycle1.name}" created: 3 items signed, 1 open AVVIKELSE, evidence attached`
  )
  console.log(
    `    → ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/laglistor/kontroller/${cycle1.id}`
  )

  // ── Cycle 2: Ready to seal BUT blocked by DRAFT styrdokument ──────────
  // Items 3 + 4 — DISJOINT from cycle 1's items 0-2 so the DRAFT-doc
  // evidence linked to cycle 2's first item is NOT visible to cycle 1.
  // gatherSealEvidenceForCycle traverses cycle item → source LawListItem →
  // live links, so any link on a shared LawListItem leaks across cycles.
  const itemsForCycle2 = lawList.items.slice(3, 5)
  const cycle2 = await prisma.complianceAuditCycle.create({
    data: {
      workspace_id: workspace.id,
      law_list_id: lawList.id,
      name: 'DEMO — Draft-dokument blockar',
      audit_type: 'INTERN',
      scheduled_start: new Date('2026-01-15T00:00:00Z'),
      scheduled_end: new Date('2026-03-31T00:00:00Z'),
      law_change_cutoff_date: new Date('2026-01-01T00:00:00Z'),
      lead_auditor_user_id: owner.user_id,
      created_by_user_id: owner.user_id,
      status: 'AVSLUTAD',
      scope_definition: { kind: 'all' },
    },
  })
  for (const item of itemsForCycle2) {
    await prisma.complianceAuditItem.create({
      data: {
        cycle_id: cycle2.id,
        law_list_item_id: item.id,
        efterlevnadsbedomning: 'UPPFYLLD',
        motivering: 'Demo-bedömning.',
        reviewed_at: new Date(),
        reviewed_by_user_id: owner.user_id,
        signed_off_at: new Date(),
        signed_off_by_user_id: owner.user_id,
      },
    })
  }
  await prisma.workspaceDocumentListItemLink.create({
    data: {
      document_id: draftDoc.id,
      list_item_id: itemsForCycle2[0]!.id,
      linked_by: owner.user_id,
    },
  })

  console.log(
    `  ✓ Cycle 2 "${cycle2.name}" created: 2 items signed, DRAFT styrdokument as evidence`
  )
  console.log(
    `    → ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/laglistor/kontroller/${cycle2.id}`
  )

  console.log('\n✅ Seed complete. Next steps:')
  console.log('   1. pnpm dev')
  console.log('   2. Log in as ' + owner.user.email)
  console.log('   3. Navigate to /laglistor/kontroller')
  console.log(
    '   4. Click into each DEMO cycle and exercise the Fastställ flow'
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

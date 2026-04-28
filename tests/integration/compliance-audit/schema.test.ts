/**
 * Story 21.1: Integration tests for compliance audit cycle schema.
 *
 * Verifies DB-level constraints that the type-only unit test cannot:
 * - Cascade delete from cycle → children
 * - Restrict delete of LawListItem referenced by a cycle item
 *
 * Story 21.26 — XOR CHECK on compliance_evidence_snapshots removed (table
 * dropped alongside the SEAL collapse).
 *
 * Requires: real Prisma connection to a DB with the Story 21.1 migration
 * applied (either local dev DB or a test DB). Not run in CI — excluded
 * via vitest integration config; see `.github/workflows/ci.yml`.
 *
 * The suite scopes every test to uniquely-named workspace+user records so
 * it can clean up after itself without touching unrelated data.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient, AuditType, ComplianceCycleStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Unique suffix to avoid collisions with concurrent runs or leftover data.
const RUN_SUFFIX = `t21-1-${Date.now()}`

const TEST_USER_ID = `user-${RUN_SUFFIX}`
const TEST_WORKSPACE_ID = `ws-${RUN_SUFFIX}`
const TEST_LAW_LIST_ID = `ll-${RUN_SUFFIX}`
const TEST_LAW_LIST_ITEM_ID = `lli-${RUN_SUFFIX}`
const TEST_LEGAL_DOCUMENT_ID = `ld-${RUN_SUFFIX}`

describe('Story 21.1: Compliance Audit Cycle schema (integration)', () => {
  beforeAll(async () => {
    // Seed the minimal prerequisite records: user → workspace → legal doc →
    // law list → law list item. All fields are the minimum required per the
    // existing schema. Cleanup runs in afterAll.
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: `${RUN_SUFFIX}@example.test`,
        name: 'Test Auditor',
      },
    })

    await prisma.workspace.create({
      data: {
        id: TEST_WORKSPACE_ID,
        name: `Integration WS ${RUN_SUFFIX}`,
        slug: `ws-${RUN_SUFFIX}`,
        owner_id: TEST_USER_ID,
      },
    })

    // LegalDocument is needed because LawListItem.document_id is a FK.
    // Minimum-viable record — content_type + document_number + slug + source_url
    // are required. content_type enum values and status enum values verified
    // against prisma/schema.prisma (ContentType: SFS_LAW..., DocumentStatus: ACTIVE...).
    await prisma.legalDocument.create({
      data: {
        id: TEST_LEGAL_DOCUMENT_ID,
        content_type: 'SFS_LAW',
        document_number: `SFS-TEST-${RUN_SUFFIX}`,
        slug: `sfs-test-${RUN_SUFFIX}`,
        title: 'Integration Test Document',
        source_url: 'https://example.test/integration',
        status: 'ACTIVE',
      },
    })

    await prisma.lawList.create({
      data: {
        id: TEST_LAW_LIST_ID,
        workspace_id: TEST_WORKSPACE_ID,
        name: 'Integration laglista',
      },
    })

    await prisma.lawListItem.create({
      data: {
        id: TEST_LAW_LIST_ITEM_ID,
        law_list_id: TEST_LAW_LIST_ID,
        document_id: TEST_LEGAL_DOCUMENT_ID,
      },
    })
  })

  afterAll(async () => {
    // Cascade from workspace and law_list handles most of the cleanup.
    // Explicit deletion covers records outside those cascades.
    await prisma.complianceAuditCycle.deleteMany({
      where: { workspace_id: TEST_WORKSPACE_ID },
    })
    await prisma.lawListItem.deleteMany({
      where: { id: TEST_LAW_LIST_ITEM_ID },
    })
    await prisma.lawList.deleteMany({ where: { id: TEST_LAW_LIST_ID } })
    await prisma.workspace.deleteMany({ where: { id: TEST_WORKSPACE_ID } })
    await prisma.legalDocument.deleteMany({
      where: { id: TEST_LEGAL_DOCUMENT_ID },
    })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
    await prisma.$disconnect()
  })

  async function makeBaseCycle() {
    return prisma.complianceAuditCycle.create({
      data: {
        workspace_id: TEST_WORKSPACE_ID,
        law_list_id: TEST_LAW_LIST_ID,
        name: `Cycle ${RUN_SUFFIX}`,
        scope_definition: { kind: 'all' },
        audit_type: AuditType.INTERN,
        scheduled_start: new Date(),
        scheduled_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
        law_change_cutoff_date: new Date(),
        status: ComplianceCycleStatus.PAGAENDE,
        lead_auditor_user_id: TEST_USER_ID,
        created_by_user_id: TEST_USER_ID,
      },
    })
  }

  // Story 21.26 — `compliance_evidence_snapshots` table dropped alongside the
  // SEAL collapse. The XOR CHECK constraint test block is removed; the only
  // writer was sealCycle's gather-seal-evidence path, which no longer exists.

  describe('Cascade delete from cycle', () => {
    it('deleting a cycle also deletes its items + findings + reports', async () => {
      const cycle = await makeBaseCycle()

      const item = await prisma.complianceAuditItem.create({
        data: {
          cycle_id: cycle.id,
          law_list_item_id: TEST_LAW_LIST_ITEM_ID,
        },
      })
      const finding = await prisma.complianceFinding.create({
        data: {
          cycle_id: cycle.id,
          type: 'AVVIKELSE',
          severity: 'MINOR',
          title: 'Integration test finding',
          description: 'desc',
        },
      })
      const report = await prisma.complianceAuditReport.create({
        data: {
          cycle_id: cycle.id,
          report_kind: 'COMPLETE',
          manifest: { stub: true },
        },
      })

      await prisma.complianceAuditCycle.delete({ where: { id: cycle.id } })

      const [stillItem, stillFinding, stillReport] = await Promise.all([
        prisma.complianceAuditItem.findUnique({ where: { id: item.id } }),
        prisma.complianceFinding.findUnique({ where: { id: finding.id } }),
        prisma.complianceAuditReport.findUnique({ where: { id: report.id } }),
      ])
      expect(stillItem).toBeNull()
      expect(stillFinding).toBeNull()
      expect(stillReport).toBeNull()
    })
  })

  describe('Restrict delete of LawListItem referenced by cycle item', () => {
    it('blocks deletion of a LawListItem that a cycle item points to', async () => {
      const cycle = await makeBaseCycle()

      await prisma.complianceAuditItem.create({
        data: {
          cycle_id: cycle.id,
          law_list_item_id: TEST_LAW_LIST_ITEM_ID,
        },
      })

      await expect(
        prisma.lawListItem.delete({ where: { id: TEST_LAW_LIST_ITEM_ID } })
      ).rejects.toThrow()

      // Clean up: delete cycle first, then the item delete in afterAll works.
      await prisma.complianceAuditCycle.delete({ where: { id: cycle.id } })
    })
  })
})

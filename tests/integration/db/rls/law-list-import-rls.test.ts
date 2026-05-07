/**
 * Story 24.1: Cross-workspace leak test for the three new Epic 24 tables.
 *
 * NOTE on RLS in this project — `20260430120000_enable_rls_public_tables`
 * documents the canonical pattern: every public table is
 * "RLS-enabled-no-policy" (default deny for non-bypass roles). Prisma
 * connects as the postgres role (BYPASSRLS), so we cannot exercise RLS
 * via Prisma queries. The `LawList` "RLS test pattern" referenced by AC 14
 * is in fact a workspace-scoping test (see
 * `tests/integration/workspace/isolation.test.ts`). This test mirrors that
 * shape for `LawListImport`, `LawListImportRow`, and `CatalogIngestRequest`.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

const TEST_PREFIX = 'test-24.1-rls-'

let userAId: string
let userBId: string
let workspaceAId: string
let workspaceBId: string
let importAId: string
let importBId: string
let rowAId: string
let rowBId: string
let requestAId: string
let requestBId: string

async function cleanupTestData() {
  await prisma.catalogIngestRequest.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })
  await prisma.lawListImportRow.deleteMany({
    where: { import: { workspace_id: { startsWith: TEST_PREFIX } } },
  })
  await prisma.lawListImport.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })
  await prisma.workspaceMember.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })
  await prisma.workspace.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { id: { startsWith: TEST_PREFIX } },
  })
}

describe('Cross-workspace isolation — Epic 24 import tables', () => {
  beforeAll(async () => {
    await cleanupTestData()

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          id: `${TEST_PREFIX}user-a`,
          email: `${TEST_PREFIX}user-a@test.com`,
          name: 'A',
        },
      }),
      prisma.user.create({
        data: {
          id: `${TEST_PREFIX}user-b`,
          email: `${TEST_PREFIX}user-b@test.com`,
          name: 'B',
        },
      }),
    ])
    userAId = userA.id
    userBId = userB.id

    const [wsA, wsB] = await Promise.all([
      prisma.workspace.create({
        data: {
          id: `${TEST_PREFIX}ws-a`,
          name: 'A',
          slug: `${TEST_PREFIX}ws-a`,
          owner_id: userAId,
          members: { create: { user_id: userAId, role: 'OWNER' } },
        },
      }),
      prisma.workspace.create({
        data: {
          id: `${TEST_PREFIX}ws-b`,
          name: 'B',
          slug: `${TEST_PREFIX}ws-b`,
          owner_id: userBId,
          members: { create: { user_id: userBId, role: 'OWNER' } },
        },
      }),
    ])
    workspaceAId = wsA.id
    workspaceBId = wsB.id

    const importA = await prisma.lawListImport.create({
      data: {
        workspace_id: workspaceAId,
        created_by_user_id: userAId,
        filename: 'a.xlsx',
        source_type: 'xlsx',
        column_mapping: {},
        rows: {
          create: [{ row_index: 0, source_titel: 'A row', source_raw: {} }],
        },
      },
      include: { rows: true },
    })
    importAId = importA.id
    rowAId = importA.rows[0]!.id

    const importB = await prisma.lawListImport.create({
      data: {
        workspace_id: workspaceBId,
        created_by_user_id: userBId,
        filename: 'b.xlsx',
        source_type: 'xlsx',
        column_mapping: {},
        rows: {
          create: [{ row_index: 0, source_titel: 'B row', source_raw: {} }],
        },
      },
      include: { rows: true },
    })
    importBId = importB.id
    rowBId = importB.rows[0]!.id

    const [reqA, reqB] = await Promise.all([
      prisma.catalogIngestRequest.create({
        data: {
          workspace_id: workspaceAId,
          import_row_id: rowAId,
          requested_by_user_id: userAId,
        },
      }),
      prisma.catalogIngestRequest.create({
        data: {
          workspace_id: workspaceBId,
          import_row_id: rowBId,
          requested_by_user_id: userBId,
        },
      }),
    ])
    requestAId = reqA.id
    requestBId = reqB.id
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  test('LawListImport — workspace A scoped query does NOT leak workspace B imports', async () => {
    const aOnly = await prisma.lawListImport.findMany({
      where: { workspace_id: workspaceAId },
    })
    expect(aOnly).toHaveLength(1)
    expect(aOnly[0]?.id).toBe(importAId)
    expect(aOnly.find((i) => i.id === importBId)).toBeUndefined()

    const crossQuery = await prisma.lawListImport.findFirst({
      where: { workspace_id: workspaceAId, id: importBId },
    })
    expect(crossQuery).toBeNull()
  })

  test('LawListImportRow — workspace A scoped query does NOT leak workspace B rows', async () => {
    const aRows = await prisma.lawListImportRow.findMany({
      where: { import: { workspace_id: workspaceAId } },
    })
    expect(aRows).toHaveLength(1)
    expect(aRows[0]?.id).toBe(rowAId)

    const crossQuery = await prisma.lawListImportRow.findFirst({
      where: {
        import: { workspace_id: workspaceAId },
        id: rowBId,
      },
    })
    expect(crossQuery).toBeNull()
  })

  test('CatalogIngestRequest — workspace A scoped query does NOT leak workspace B requests', async () => {
    const aReqs = await prisma.catalogIngestRequest.findMany({
      where: { workspace_id: workspaceAId },
    })
    expect(aReqs).toHaveLength(1)
    expect(aReqs[0]?.id).toBe(requestAId)
    expect(aReqs.find((r) => r.id === requestBId)).toBeUndefined()

    const crossQuery = await prisma.catalogIngestRequest.findFirst({
      where: { workspace_id: workspaceAId, id: requestBId },
    })
    expect(crossQuery).toBeNull()
  })
})

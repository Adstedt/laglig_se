/**
 * Story 24.1 + 24.2: Integration tests for law-list-import server actions.
 *
 * Story 24.1 — assert each stub returns NOT_IMPLEMENTED cleanly + verify
 *   cross-workspace queries do not leak (createImport + parseImportFile
 *   were stubs at the time).
 * Story 24.2 — `createImport` and `parseImportFile` are now implemented
 *   and run end-to-end against the real DB. The remaining 6 actions stay
 *   as NOT_IMPLEMENTED stubs and are verified as such here.
 *
 * `withWorkspace` is mocked to short-circuit auth/permission, returning
 * a context tied to the test workspace IDs created in `beforeAll`.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// State variable updated in beforeAll so the mock can reach the live IDs.
let mockCtxUserId = 'unset'
let mockCtxWorkspaceId = 'unset'

vi.mock('@/lib/auth/workspace-context', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/auth/workspace-context')
  >('@/lib/auth/workspace-context')
  return {
    ...actual,
    withWorkspace: vi.fn(
      async <T>(cb: (_ctx: unknown) => Promise<T>): Promise<T> => {
        return cb({
          userId: mockCtxUserId,
          workspaceId: mockCtxWorkspaceId,
          workspaceName: 'mock',
          workspaceSlug: 'mock',
          workspaceStatus: 'ACTIVE',
          role: 'OWNER',
          hasPermission: () => true,
        })
      }
    ),
  }
})

vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(async () => ({ email: 'admin@laglig.se' })),
}))

// Story 24.3: mock matchRowsBatch so runMatching tests don't hit Anthropic.
// Each test injects canned MatchResult[] via mockMatchRowsBatch.mockResolvedValue.
vi.mock('@/lib/import/matcher', async () => {
  const actual = await vi.importActual<typeof import('@/lib/import/matcher')>(
    '@/lib/import/matcher'
  )
  return {
    ...actual,
    matchRowsBatch: vi.fn(),
  }
})

// Story 24.4: mock email send so commitImport doesn't make a real Resend call.
vi.mock('@/lib/email/email-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/email/email-service')
  >('@/lib/email/email-service')
  return {
    ...actual,
    sendEmail: vi.fn(async () => ({ success: true })),
  }
})

// Story 24.4: mock next/cache.revalidatePath — outside an App Router request
// context (which is the case in vitest) it throws "Invariant: static
// generation store missing".
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}))

import { prisma } from '@/lib/prisma'
import {
  acceptAllHigh,
  acceptRow,
  commitImport,
  createImport,
  getImport,
  parseImportFile,
  rejectRow,
  replaceRowMatch,
  requestCatalogAdd,
  runMatching,
  undoRowDecision,
} from '@/app/actions/law-list-import'
// (Story 24.5 implements listPendingCatalogRequests + fulfillCatalogRequest;
// the obsolete NOT_IMPLEMENTED stub-shape tests for those actions used to
// live in this file's "remaining stubs" describe block but were removed
// when 24.5 landed. The actions are now covered by their dedicated
// integration test file at tests/integration/app/actions/catalog-ingest-request.test.ts.)

const TEST_PREFIX = 'test-24.1-act-'
const validUUID = '550e8400-e29b-41d4-a716-446655440000'

let userAId: string
let userBId: string
let workspaceAId: string
let workspaceBId: string
let importAId: string
let importBId: string

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

describe('Stories 24.1 + 24.2 — server actions', () => {
  beforeAll(async () => {
    await cleanupTestData()

    const userA = await prisma.user.create({
      data: {
        id: `${TEST_PREFIX}user-a`,
        email: `${TEST_PREFIX}user-a@test.com`,
        name: 'User A',
      },
    })
    userAId = userA.id
    mockCtxUserId = userAId

    const userB = await prisma.user.create({
      data: {
        id: `${TEST_PREFIX}user-b`,
        email: `${TEST_PREFIX}user-b@test.com`,
        name: 'User B',
      },
    })
    userBId = userB.id

    const wsA = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}ws-a`,
        name: 'WS A',
        slug: `${TEST_PREFIX}ws-a`,
        owner_id: userAId,
        members: { create: { user_id: userAId, role: 'OWNER' } },
      },
    })
    workspaceAId = wsA.id
    mockCtxWorkspaceId = workspaceAId

    const wsB = await prisma.workspace.create({
      data: {
        id: `${TEST_PREFIX}ws-b`,
        name: 'WS B',
        slug: `${TEST_PREFIX}ws-b`,
        owner_id: userBId,
        members: { create: { user_id: userBId, role: 'OWNER' } },
      },
    })
    workspaceBId = wsB.id

    const importA = await prisma.lawListImport.create({
      data: {
        workspace_id: workspaceAId,
        created_by_user_id: userAId,
        filename: 'a-export.xlsx',
        source_type: 'xlsx',
        column_mapping: { titel: 'col_0', sfs_nummer: 'col_1' },
        rows: {
          create: [
            {
              row_index: 0,
              source_titel: 'Row 0',
              source_raw: { col_0: 'Row 0' },
            },
            {
              row_index: 1,
              source_titel: 'Row 1',
              source_raw: { col_0: 'Row 1' },
            },
            {
              row_index: 2,
              source_titel: 'Row 2',
              source_raw: { col_0: 'Row 2' },
            },
          ],
        },
      },
    })
    importAId = importA.id

    const importB = await prisma.lawListImport.create({
      data: {
        workspace_id: workspaceBId,
        created_by_user_id: userBId,
        filename: 'b-export.csv',
        source_type: 'csv',
        column_mapping: { titel: 'col_0' },
        rows: {
          create: [
            {
              row_index: 0,
              source_titel: 'B Row 0',
              source_raw: { col_0: 'B Row 0' },
            },
          ],
        },
      },
    })
    importBId = importB.id
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Story 24.5: removed the last 2 NOT_IMPLEMENTED stub tests
  // (`listPendingCatalogRequests` and `fulfillCatalogRequest`) that used to
  // live here. Both are now real implementations covered by the dedicated
  // file `tests/integration/app/actions/catalog-ingest-request.test.ts`.

  describe('Zod-validation short-circuits before stub body', () => {
    test('createImport rejects empty filename', async () => {
      const result = await createImport({
        filename: '',
        source_type: 'xlsx',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Filnamn krävs')
    })

    test('parseImportFile rejects non-uuid importId', async () => {
      const result = await parseImportFile({
        importId: 'not-a-uuid',
        fileBuffer: 'UEsDBBQA',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Ogiltigt import-ID')
    })
  })

  describe('workspace-scoped Prisma reads do not leak across workspaces', () => {
    test('workspace A query only returns workspace A imports', async () => {
      const imports = await prisma.lawListImport.findMany({
        where: { workspace_id: workspaceAId },
      })
      expect(imports).toHaveLength(1)
      expect(imports[0]?.id).toBe(importAId)
      expect(imports.find((i) => i.id === importBId)).toBeUndefined()
    })

    test('workspace A query returns 3 import rows for its import', async () => {
      const rows = await prisma.lawListImportRow.findMany({
        where: { import: { workspace_id: workspaceAId } },
        orderBy: { row_index: 'asc' },
      })
      expect(rows).toHaveLength(3)
      expect(rows.map((r) => r.row_index)).toEqual([0, 1, 2])
    })

    test('workspace B query only returns workspace B import + rows', async () => {
      const imports = await prisma.lawListImport.findMany({
        where: { workspace_id: workspaceBId },
      })
      expect(imports).toHaveLength(1)
      expect(imports[0]?.filename).toBe('b-export.csv')

      const rows = await prisma.lawListImportRow.findMany({
        where: { import: { workspace_id: workspaceBId } },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.source_titel).toBe('B Row 0')
    })
  })

  // ============================================================================
  // Story 24.2: createImport + parseImportFile end-to-end
  // ============================================================================

  describe('Story 24.2: createImport + parseImportFile happy paths', () => {
    const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'import')

    test('createImport persists a LawListImport row with status=UPLOADED + writes activity log', async () => {
      const result = await createImport({
        filename: '24.2-create-test.xlsx',
        source_type: 'xlsx',
      })
      expect(result.success).toBe(true)
      expect(result.data?.importId).toBeDefined()

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: result.data!.importId },
      })
      expect(persisted).not.toBeNull()
      expect(persisted?.workspace_id).toBe(workspaceAId)
      expect(persisted?.created_by_user_id).toBe(userAId)
      expect(persisted?.status).toBe('UPLOADED')
      expect(persisted?.row_count).toBe(0)
      expect(persisted?.filename).toBe('24.2-create-test.xlsx')

      const activity = await prisma.activityLog.findFirst({
        where: {
          entity_type: 'law_list_import',
          entity_id: result.data!.importId,
          action: 'law_list_import.created',
        },
      })
      expect(activity).not.toBeNull()
      expect(activity?.workspace_id).toBe(workspaceAId)

      // Cleanup local fixture row.
      await prisma.lawListImport.delete({
        where: { id: result.data!.importId },
      })
    })

    test('parseImportFile end-to-end: createImport → parse Notisum xlsx → rows + columnMapping populated', async () => {
      const created = await createImport({
        filename: 'notisum-export-sample.xlsx',
        source_type: 'xlsx',
      })
      expect(created.success).toBe(true)
      const importId = created.data!.importId

      const fileBuffer = readFileSync(
        join(FIXTURE_DIR, 'notisum-export-sample.xlsx')
      ).toString('base64')

      const parsed = await parseImportFile({ importId, fileBuffer })
      expect(parsed.success).toBe(true)
      expect(parsed.data?.rowCount).toBe(30)
      expect(parsed.data?.truncated).toBe(false)
      expect(parsed.data?.columnMapping.titel).toBe('Lagens namn')
      expect(parsed.data?.columnMapping.sfs_nummer).toBe('SFS-nr')

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      expect(persisted?.row_count).toBe(30)
      expect(persisted?.status).toBe('UPLOADED') // stays UPLOADED — 24.3 flips to MATCHING
      expect(persisted?.error_message).toBeNull()

      const persistedRows = await prisma.lawListImportRow.findMany({
        where: { import_id: importId },
        orderBy: { row_index: 'asc' },
        take: 3,
      })
      expect(persistedRows).toHaveLength(3)
      expect(persistedRows[0]?.source_titel).toBe('Arbetsmiljölag')
      expect(persistedRows[0]?.source_sfs_nummer).toBe('1977:1160')

      // Cleanup.
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importId },
      })
      await prisma.lawListImport.delete({ where: { id: importId } })
    })

    test('parseImportFile end-to-end: CSV with semicolon delimiter + BOM', async () => {
      const created = await createImport({
        filename: 'internal-spreadsheet-sample.csv',
        source_type: 'csv',
      })
      const importId = created.data!.importId

      const fileBuffer = readFileSync(
        join(FIXTURE_DIR, 'internal-spreadsheet-sample.csv')
      ).toString('base64')

      const parsed = await parseImportFile({ importId, fileBuffer })
      expect(parsed.success).toBe(true)
      expect(parsed.data?.rowCount).toBe(15)
      expect(parsed.data?.columnMapping.titel).toBe('Lag')
      expect(parsed.data?.columnMapping.sfs_nummer).toBe('Nummer')

      // Cleanup.
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importId },
      })
      await prisma.lawListImport.delete({ where: { id: importId } })
    })
  })

  describe('Story 24.2: parseImportFile failure modes', () => {
    test('rejects non-existent import (workspace mismatch)', async () => {
      // Use the test fixture from workspace B — current mock context is on A.
      const result = await parseImportFile({
        importId: importBId,
        fileBuffer: Buffer.from('hello').toString('base64'),
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Importen hittades inte')
    })

    test('rejects malformed xlsx → status=FAILED + Swedish error_message set', async () => {
      const created = await createImport({
        filename: 'broken.xlsx',
        source_type: 'xlsx',
      })
      const importId = created.data!.importId

      const result = await parseImportFile({
        importId,
        fileBuffer: Buffer.from('this is not a valid xlsx').toString('base64'),
      })
      expect(result.success).toBe(false)

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      expect(persisted?.status).toBe('FAILED')
      // xlsx silently returns an empty workbook on garbage input, so we hit
      // the "tom" branch rather than the "kunde inte läsa" branch. Either is
      // a valid failure mode; the contract is just status=FAILED + a Swedish
      // user-facing error.
      expect(
        persisted?.error_message?.includes('tom') ||
          persisted?.error_message?.includes('kunde inte läsa')
      ).toBe(true)

      // Cleanup.
      await prisma.lawListImport.delete({ where: { id: importId } })
    })

    test('rejects empty paste → status=FAILED + Swedish error', async () => {
      const created = await createImport({
        filename: 'empty.txt',
        source_type: 'paste',
      })
      const importId = created.data!.importId

      const result = await parseImportFile({
        importId,
        fileBuffer: Buffer.from('   \n   \n').toString('base64'),
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('tom')

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      expect(persisted?.status).toBe('FAILED')

      await prisma.lawListImport.delete({ where: { id: importId } })
    })

    test('rejects oversized file via Zod max-length on fileBuffer', async () => {
      // Construct a string longer than the 7 MB base64 cap.
      const oversized = 'A'.repeat(7 * 1024 * 1024 + 1)
      const result = await parseImportFile({
        importId: importAId, // valid import in workspace A
        fileBuffer: oversized,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('5 MB')
    })
  })

  // ============================================================================
  // Story 24.3: runMatching end-to-end
  // ============================================================================

  describe('Story 24.3: runMatching end-to-end (matcher mocked)', () => {
    let importIdForMatching: string
    const rowIds: string[] = []
    let realDocIds: string[] = []

    beforeAll(async () => {
      // Pull 4 real LegalDocument IDs to use as mock match results — Prisma's
      // FK on matched_document_id rejects synthetic IDs with P2003.
      const docs = await prisma.legalDocument.findMany({
        select: { id: true },
        take: 4,
      })
      realDocIds = docs.map((d) => d.id)
      if (realDocIds.length < 4) {
        throw new Error(
          'runMatching integration test needs ≥4 LegalDocument rows in the DB; found ' +
            realDocIds.length
        )
      }

      // Build a fresh parsed import in workspace A with 5 rows in known
      // expected tiers. The matcher is mocked so we control the outcomes.
      const created = await createImport({
        filename: '24.3-runmatching.xlsx',
        source_type: 'xlsx',
      })
      importIdForMatching = created.data!.importId

      // Bypass parseImportFile and seed rows directly so we don't depend on
      // a fixture parsing into exactly 5 rows.
      const rowsToCreate = [
        {
          row_index: 0,
          source_titel: 'Arbetsmiljölag',
          source_sfs_nummer: 'SFS 1977:1160',
        },
        {
          row_index: 1,
          source_titel: 'Föreskrifter om bullerexponering',
          source_sfs_nummer: 'AFS 2005:16',
        },
        { row_index: 2, source_titel: 'Något oklart', source_sfs_nummer: null },
        {
          row_index: 3,
          source_titel: 'GDPR',
          source_sfs_nummer: '(EU) 2016/679',
        },
        {
          row_index: 4,
          source_titel: 'Helt påhittat',
          source_sfs_nummer: null,
        },
      ]
      for (const row of rowsToCreate) {
        const created = await prisma.lawListImportRow.create({
          data: {
            import_id: importIdForMatching,
            row_index: row.row_index,
            source_titel: row.source_titel,
            source_sfs_nummer: row.source_sfs_nummer,
            source_raw: { titel: row.source_titel },
          },
        })
        rowIds.push(created.id)
      }
      await prisma.lawListImport.update({
        where: { id: importIdForMatching },
        data: { row_count: 5, column_mapping: { titel: 'titel' } },
      })
    })

    afterAll(async () => {
      await prisma.activityLog.deleteMany({
        where: { entity_id: importIdForMatching },
      })
      await prisma.chatUsageEvent.deleteMany({
        where: { workspace_id: workspaceAId },
      })
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importIdForMatching },
      })
      await prisma.lawListImport.delete({
        where: { id: importIdForMatching },
      })
    })

    test('happy path: persists match results, flips to AWAITING_REVIEW, logs activity', async () => {
      const { matchRowsBatch } = await import('@/lib/import/matcher')
      const mock = vi.mocked(matchRowsBatch)
      mock.mockResolvedValue([
        // Row 0: high (real LegalDocument FK)
        {
          matched_document_id: realDocIds[0]!,
          confidence_score: 1.0,
          confidence_tier: 'high',
          candidates: [
            {
              document_id: realDocIds[0]!,
              title: 'Arbetsmiljölag',
              document_number: 'SFS 1977:1160',
              content_type: 'SFS_LAW',
              fuzzy_score: 1.0,
              match_signals: {
                document_number_exact: true,
                document_number_suffix_match: false,
                title_trigram_score: 0,
                has_amendment_match: false,
              },
            },
          ],
          reasoning: null,
          llm_used: false,
        },
        // Row 1: high (AFS — proves non-SFS path)
        {
          matched_document_id: realDocIds[1]!,
          confidence_score: 0.92,
          confidence_tier: 'high',
          candidates: [],
          reasoning: 'AFS-nummer matchar',
          llm_used: true,
        },
        // Row 2: medium
        {
          matched_document_id: realDocIds[2]!,
          confidence_score: 0.7,
          confidence_tier: 'medium',
          candidates: [],
          reasoning: 'Titel matchar nära',
          llm_used: true,
        },
        // Row 3: high (EU — proves EU path)
        {
          matched_document_id: realDocIds[3]!,
          confidence_score: 0.95,
          confidence_tier: 'high',
          candidates: [],
          reasoning: 'GDPR identifierad',
          llm_used: true,
        },
        // Row 4: unmatched (with at least 1 candidate so it's not "hard fail")
        {
          matched_document_id: null,
          confidence_score: 0.2,
          confidence_tier: 'unmatched',
          candidates: [
            {
              document_id: realDocIds[0]!,
              title: 'Unrelated',
              document_number: 'SFS 9999:1',
              content_type: 'SFS_LAW',
              fuzzy_score: 0.4,
              match_signals: {
                document_number_exact: false,
                document_number_suffix_match: false,
                title_trigram_score: 0.4,
                has_amendment_match: false,
              },
            },
          ],
          reasoning: 'Ingen säker matchning',
          llm_used: true,
        },
      ])

      const result = await runMatching(importIdForMatching)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(
        expect.objectContaining({
          matchedHighCount: 3,
          matchedMediumCount: 1,
          unmatchedCount: 1,
        })
      )

      // Status flipped
      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importIdForMatching },
      })
      expect(persisted?.status).toBe('AWAITING_REVIEW')

      // Per-row state persisted
      const persistedRows = await prisma.lawListImportRow.findMany({
        where: { import_id: importIdForMatching },
        orderBy: { row_index: 'asc' },
      })
      expect(persistedRows.map((r) => r.match_status)).toEqual([
        'MATCHED_HIGH',
        'MATCHED_HIGH',
        'MATCHED_MEDIUM',
        'MATCHED_HIGH',
        'UNMATCHED',
      ])
      expect(persistedRows[0]?.confidence_score).toBe(1.0)
      expect(persistedRows[0]?.match_candidates).toBeDefined()

      // Activity-log entries: started + completed
      const activity = await prisma.activityLog.findMany({
        where: {
          entity_type: 'law_list_import',
          entity_id: importIdForMatching,
          action: {
            in: [
              'law_list_import.matching_started',
              'law_list_import.matching_completed',
            ],
          },
        },
        orderBy: { created_at: 'asc' },
      })
      expect(activity).toHaveLength(2)
      expect(activity[0]?.action).toBe('law_list_import.matching_started')
      expect(activity[1]?.action).toBe('law_list_import.matching_completed')
    })

    test('refuses to re-run on a non-UPLOADED import (idempotency)', async () => {
      // After previous test, status is AWAITING_REVIEW.
      const result = await runMatching(importIdForMatching)
      expect(result.success).toBe(false)
      expect(result.error).toContain('UPLOADED')
    })

    test('rejects when import does not exist', async () => {
      const result = await runMatching(validUUID)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Importen hittades inte')
    })

    test('rejects empty importId', async () => {
      const result = await runMatching('')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Ogiltigt import-ID')
    })
  })

  describe('Story 24.3: runMatching failure modes', () => {
    test('flips to FAILED + logs matching_failed when >50% of rows are hard-unmatched', async () => {
      // Fresh import with 4 rows, mock returns 3 hard-unmatched (no candidates).
      const created = await createImport({
        filename: '24.3-failure-rate.xlsx',
        source_type: 'xlsx',
      })
      const importId = created.data!.importId

      await prisma.lawListImportRow.createMany({
        data: [0, 1, 2, 3].map((i) => ({
          import_id: importId,
          row_index: i,
          source_titel: `Row ${i}`,
          source_raw: { titel: `Row ${i}` },
        })),
      })
      await prisma.lawListImport.update({
        where: { id: importId },
        data: { row_count: 4, column_mapping: { titel: 'titel' } },
      })

      const { matchRowsBatch } = await import('@/lib/import/matcher')
      const mock = vi.mocked(matchRowsBatch)
      mock.mockResolvedValue(
        [0, 1, 2, 3].map((i) => ({
          matched_document_id: null,
          confidence_score: 0,
          confidence_tier: 'unmatched' as const,
          // 3 of 4 rows have empty candidates → hard-unmatched
          candidates:
            i === 0
              ? [
                  {
                    document_id: 'x',
                    title: 'X',
                    document_number: null,
                    content_type: 'SFS_LAW',
                    fuzzy_score: 0.3,
                    match_signals: {
                      document_number_exact: false,
                      document_number_suffix_match: false,
                      title_trigram_score: 0.3,
                      has_amendment_match: false,
                    },
                  },
                ]
              : [],
          reasoning: 'Inga kandidater i katalogen',
          llm_used: false,
        }))
      )

      const result = await runMatching(importId)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Matchningen misslyckades')

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      expect(persisted?.status).toBe('FAILED')
      expect(persisted?.error_message).toContain('Matchningen misslyckades')

      // matching_failed activity logged
      const failedLog = await prisma.activityLog.findFirst({
        where: {
          entity_id: importId,
          action: 'law_list_import.matching_failed',
        },
      })
      expect(failedLog).not.toBeNull()

      // Cleanup
      await prisma.activityLog.deleteMany({ where: { entity_id: importId } })
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importId },
      })
      await prisma.lawListImport.delete({ where: { id: importId } })
    })

    test('flips back to UPLOADED when matchRowsBatch throws (Anthropic down)', async () => {
      const created = await createImport({
        filename: '24.3-llm-down.xlsx',
        source_type: 'xlsx',
      })
      const importId = created.data!.importId

      await prisma.lawListImportRow.create({
        data: {
          import_id: importId,
          row_index: 0,
          source_titel: 'Test',
          source_raw: { titel: 'Test' },
        },
      })
      await prisma.lawListImport.update({
        where: { id: importId },
        data: { row_count: 1, column_mapping: { titel: 'titel' } },
      })

      const { matchRowsBatch } = await import('@/lib/import/matcher')
      const mock = vi.mocked(matchRowsBatch)
      mock.mockRejectedValueOnce(new Error('Anthropic 503'))

      const result = await runMatching(importId)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Matchningstjänsten')

      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      // Flipped back to UPLOADED so user can retry once API recovers
      expect(persisted?.status).toBe('UPLOADED')

      // Cleanup
      await prisma.activityLog.deleteMany({ where: { entity_id: importId } })
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importId },
      })
      await prisma.lawListImport.delete({ where: { id: importId } })
    })
  })

  // ============================================================================
  // Story 24.4: review-surface server actions
  // ============================================================================

  describe('Story 24.4: review-surface server actions', () => {
    let realDocId1: string
    let realDocId2: string
    let importId: string
    let highRowId: string
    let mediumRowId: string
    let unmatchedRowId: string

    beforeAll(async () => {
      const docs = await prisma.legalDocument.findMany({
        select: { id: true },
        take: 2,
      })
      realDocId1 = docs[0]!.id
      realDocId2 = docs[1]!.id

      const created = await createImport({
        filename: '24.4-actions.xlsx',
        source_type: 'xlsx',
      })
      importId = created.data!.importId

      // Seed 3 rows in known states + flip import to AWAITING_REVIEW so the
      // review-surface actions accept them.
      const candidates = [
        {
          document_id: realDocId1,
          title: 'Cand 1',
          document_number: 'SFS 1977:1160',
          content_type: 'SFS_LAW',
          fuzzy_score: 0.95,
        },
        {
          document_id: realDocId2,
          title: 'Cand 2',
          document_number: 'SFS 2005:551',
          content_type: 'SFS_LAW',
          fuzzy_score: 0.7,
        },
      ]

      const high = await prisma.lawListImportRow.create({
        data: {
          import_id: importId,
          row_index: 0,
          source_titel: 'High row',
          source_raw: { titel: 'High row' },
          match_status: 'MATCHED_HIGH',
          matched_document_id: realDocId1,
          confidence_score: 0.95,
          match_candidates: candidates as unknown as Prisma.InputJsonValue,
        },
      })
      highRowId = high.id

      const med = await prisma.lawListImportRow.create({
        data: {
          import_id: importId,
          row_index: 1,
          source_titel: 'Medium row',
          source_raw: { titel: 'Medium row' },
          match_status: 'MATCHED_MEDIUM',
          matched_document_id: realDocId1,
          confidence_score: 0.7,
          match_candidates: candidates as unknown as Prisma.InputJsonValue,
        },
      })
      mediumRowId = med.id

      const um = await prisma.lawListImportRow.create({
        data: {
          import_id: importId,
          row_index: 2,
          source_titel: 'Unmatched row',
          source_raw: { titel: 'Unmatched row' },
          match_status: 'UNMATCHED',
          confidence_score: 0.1,
        },
      })
      unmatchedRowId = um.id

      await prisma.lawListImport.update({
        where: { id: importId },
        data: { row_count: 3, status: 'AWAITING_REVIEW' },
      })
    })

    afterAll(async () => {
      await prisma.activityLog.deleteMany({ where: { entity_id: importId } })
      await prisma.catalogIngestRequest.deleteMany({
        where: { workspace_id: workspaceAId },
      })
      // Clean up any LawList committed during the commit-idempotency test.
      await prisma.lawListItem.deleteMany({
        where: {
          law_list: {
            workspace_id: workspaceAId,
            name: { startsWith: '24.4-' },
          },
        },
      })
      await prisma.lawList.deleteMany({
        where: { workspace_id: workspaceAId, name: { startsWith: '24.4-' } },
      })
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: importId },
      })
      await prisma.lawListImport.delete({ where: { id: importId } })
    })

    test('acceptRow flips MATCHED_HIGH → ACCEPTED_BY_USER + sets user_decided_at + logs activity', async () => {
      const result = await acceptRow(highRowId)
      expect(result.success).toBe(true)

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: highRowId },
      })
      expect(row?.match_status).toBe('ACCEPTED_BY_USER')
      expect(row?.user_decided_at).not.toBeNull()

      const activity = await prisma.activityLog.findFirst({
        where: {
          entity_id: importId,
          action: 'law_list_import.row_accepted',
        },
      })
      expect(activity).not.toBeNull()
    })

    test('acceptRow is idempotent — re-accepting an already-accepted row succeeds', async () => {
      const result = await acceptRow(highRowId)
      expect(result.success).toBe(true)
    })

    test('replaceRowMatch validates candidate is in match_candidates (rejects arbitrary doc IDs)', async () => {
      // Use a real doc id that's NOT in mediumRowId's match_candidates.
      const otherDoc = await prisma.legalDocument.findFirst({
        where: { id: { notIn: [realDocId1, realDocId2] } },
        select: { id: true },
      })
      const result = await replaceRowMatch(mediumRowId, otherDoc!.id)
      expect(result.success).toBe(false)
      expect(result.error).toContain('matchningskandidaterna')
    })

    test('replaceRowMatch flips status + updates matched_document_id when candidate is valid', async () => {
      const result = await replaceRowMatch(mediumRowId, realDocId2)
      expect(result.success).toBe(true)

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: mediumRowId },
      })
      expect(row?.match_status).toBe('REPLACED_BY_USER')
      expect(row?.matched_document_id).toBe(realDocId2)
    })

    test('rejectRow flips UNMATCHED → REJECTED_BY_USER', async () => {
      const result = await rejectRow(unmatchedRowId)
      expect(result.success).toBe(true)

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: unmatchedRowId },
      })
      expect(row?.match_status).toBe('REJECTED_BY_USER')
    })

    test('undoRowDecision restores REJECTED_BY_USER unmatched-row to UNMATCHED', async () => {
      const result = await undoRowDecision(unmatchedRowId)
      expect(result.success).toBe(true)

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: unmatchedRowId },
      })
      expect(row?.match_status).toBe('UNMATCHED')
      expect(row?.user_decided_at).toBeNull()
    })

    test('requestCatalogAdd creates CatalogIngestRequest + flips → CATALOG_REQUEST_PENDING', async () => {
      const result = await requestCatalogAdd(
        unmatchedRowId,
        'Saknar AFS 2024:1'
      )
      expect(result.success).toBe(true)
      expect(result.data?.requestId).toBeDefined()

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: unmatchedRowId },
      })
      expect(row?.match_status).toBe('CATALOG_REQUEST_PENDING')

      const request = await prisma.catalogIngestRequest.findUnique({
        where: { import_row_id: unmatchedRowId },
      })
      expect(request).not.toBeNull()
      expect(request?.admin_note).toBe('Saknar AFS 2024:1')
      expect(request?.status).toBe('PENDING')
    })

    test('requestCatalogAdd idempotency — second call returns existing request id', async () => {
      const second = await requestCatalogAdd(unmatchedRowId, 'Updated note')
      expect(second.success).toBe(true)
      // Same id; admin_note NOT clobbered (intentional — first writer wins).
      const request = await prisma.catalogIngestRequest.findUnique({
        where: { import_row_id: unmatchedRowId },
      })
      expect(request?.admin_note).toBe('Saknar AFS 2024:1')
    })

    test('undoRowDecision on CATALOG_REQUEST_PENDING deletes the pending request + restores to UNMATCHED', async () => {
      const undoResult = await undoRowDecision(unmatchedRowId)
      expect(undoResult.success).toBe(true)

      const row = await prisma.lawListImportRow.findUnique({
        where: { id: unmatchedRowId },
      })
      expect(row?.match_status).toBe('UNMATCHED')

      const request = await prisma.catalogIngestRequest.findUnique({
        where: { import_row_id: unmatchedRowId },
      })
      expect(request).toBeNull()
    })

    test('acceptAllHigh bulk-flips all MATCHED_HIGH → ACCEPTED_BY_USER in a single transaction', async () => {
      // Seed 3 fresh MATCHED_HIGH rows on a new import to avoid clashing with
      // the shared per-test rows above.
      const newImport = await createImport({
        filename: '24.4-bulk.xlsx',
        source_type: 'xlsx',
      })
      const newImportId = newImport.data!.importId
      await prisma.lawListImportRow.createMany({
        data: [0, 1, 2].map((i) => ({
          import_id: newImportId,
          row_index: i,
          source_titel: `Bulk row ${i}`,
          source_raw: { titel: `Bulk row ${i}` },
          match_status: 'MATCHED_HIGH' as const,
          matched_document_id: realDocId1,
          confidence_score: 0.95,
        })),
      })
      await prisma.lawListImport.update({
        where: { id: newImportId },
        data: { row_count: 3, status: 'AWAITING_REVIEW' },
      })

      const result = await acceptAllHigh(newImportId)
      expect(result.success).toBe(true)
      expect(result.data?.count).toBe(3)

      const accepted = await prisma.lawListImportRow.findMany({
        where: { import_id: newImportId, match_status: 'ACCEPTED_BY_USER' },
      })
      expect(accepted).toHaveLength(3)

      // Cleanup
      await prisma.activityLog.deleteMany({ where: { entity_id: newImportId } })
      await prisma.lawListImportRow.deleteMany({
        where: { import_id: newImportId },
      })
      await prisma.lawListImport.delete({ where: { id: newImportId } })
    })

    test('getImport hydrates import + rows + counts in a single call', async () => {
      const result = await getImport(importId)
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe(importId)
      expect(result.data?.rows.length).toBe(3)
      expect(result.data?.counts.total).toBe(3)
    })

    test('commitImport creates LawList + LawListItems for ACCEPTED_BY_USER + REPLACED_BY_USER rows; idempotent on re-call', async () => {
      // At this point: highRow=ACCEPTED, mediumRow=REPLACED, unmatchedRow=UNMATCHED.
      // commitImport should produce a LawList with 2 items.
      const result = await commitImport({
        importId,
        listName: '24.4-committed-list',
      })
      expect(result.success).toBe(true)
      const lawListId = result.data!.lawListId

      const lawList = await prisma.lawList.findUnique({
        where: { id: lawListId },
        include: { items: true },
      })
      expect(lawList?.name).toBe('24.4-committed-list')
      expect(lawList?.items).toHaveLength(2)
      const docIds = lawList?.items.map((i) => i.document_id).sort()
      expect(docIds).toEqual([realDocId1, realDocId2].sort())

      // Import flipped to COMMITTED with the new law-list FK
      const persisted = await prisma.lawListImport.findUnique({
        where: { id: importId },
      })
      expect(persisted?.status).toBe('COMMITTED')
      expect(persisted?.committed_law_list_id).toBe(lawListId)
      expect(persisted?.committed_at).not.toBeNull()

      // Idempotency — second call returns the existing law_list_id, no duplicate
      const second = await commitImport({
        importId,
        listName: '24.4-different-name',
      })
      expect(second.success).toBe(true)
      expect(second.data?.lawListId).toBe(lawListId)
    })

    test('commitImport refuses when status is not AWAITING_REVIEW (and the import is not already COMMITTED)', async () => {
      // Status is now COMMITTED from the previous test; the idempotency path
      // returns the existing law_list_id rather than refusing — verified above.
      // Test the explicit refusal by spinning up a fresh UPLOADED import.
      const fresh = await createImport({
        filename: '24.4-uploaded.xlsx',
        source_type: 'xlsx',
      })
      const result = await commitImport({
        importId: fresh.data!.importId,
        listName: '24.4-doomed',
      })
      expect(result.success).toBe(false)
      // Error string: "Importen kan bara bekräftas när den väntar på granskning"
      expect(result.error).toContain('väntar på granskning')

      await prisma.lawListImport.delete({ where: { id: fresh.data!.importId } })
    })
  })
})

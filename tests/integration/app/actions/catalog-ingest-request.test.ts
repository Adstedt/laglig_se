/**
 * Story 24.5: integration tests for the catalog-ingest-request admin actions.
 *
 * Mocks `getAdminSession`, `next/cache.revalidatePath`, and the email
 * sender so the tests run cleanly under vitest. Real Prisma + DB.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'

vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/email/email-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/email/email-service')
  >('@/lib/email/email-service')
  return {
    ...actual,
    sendEmail: vi.fn(async () => ({ success: true })),
  }
})

import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin/auth'
import { sendEmail } from '@/lib/email/email-service'
import {
  fulfillCatalogRequest,
  getCatalogRequestPipCount,
  listPendingCatalogRequests,
  rejectCatalogRequest,
} from '@/app/actions/catalog-ingest-request'

const TEST_PREFIX = 'test-24.5-'
const mockGetAdminSession = vi.mocked(getAdminSession)
const mockSendEmail = vi.mocked(sendEmail)

let adminUserId: string
let workspaceUserId: string
let workspaceId: string
let row1Id: string // PENDING request will be tied to this row
let row2Id: string // for second/idempotency request
let row3Id: string // for rejection
let pendingRequestId: string
let rejectableRequestId: string
let secondRequestId: string
let realDocId: string

async function cleanup() {
  await prisma.activityLog.deleteMany({
    where: { workspace_id: { startsWith: TEST_PREFIX } },
  })
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

beforeAll(async () => {
  await cleanup()

  // Pull a real LegalDocument id for fulfilment validation
  const doc = await prisma.legalDocument.findFirst({ select: { id: true } })
  realDocId = doc!.id

  const adminUser = await prisma.user.create({
    data: {
      id: `${TEST_PREFIX}admin`,
      email: `${TEST_PREFIX}admin@laglig.se`,
      name: 'Admin User',
    },
  })
  adminUserId = adminUser.id

  const workspaceUser = await prisma.user.create({
    data: {
      id: `${TEST_PREFIX}user`,
      email: `${TEST_PREFIX}user@test.com`,
      name: 'Workspace User',
    },
  })
  workspaceUserId = workspaceUser.id

  const workspace = await prisma.workspace.create({
    data: {
      id: `${TEST_PREFIX}ws`,
      name: '24.5 Test Workspace',
      slug: `${TEST_PREFIX}ws`,
      owner_id: workspaceUserId,
      members: { create: { user_id: workspaceUserId, role: 'OWNER' } },
    },
  })
  workspaceId = workspace.id

  const importRow = await prisma.lawListImport.create({
    data: {
      workspace_id: workspaceId,
      created_by_user_id: workspaceUserId,
      filename: '24.5-fixture.xlsx',
      source_type: 'xlsx',
      status: 'AWAITING_REVIEW',
      row_count: 3,
      column_mapping: {},
      rows: {
        create: [
          {
            row_index: 0,
            source_titel: 'Saknad lag 1',
            source_sfs_nummer: 'AFS 2024:1',
            source_raw: { titel: 'Saknad lag 1' },
            match_status: 'CATALOG_REQUEST_PENDING',
          },
          {
            row_index: 1,
            source_titel: 'Saknad lag 2',
            source_sfs_nummer: 'AFS 2024:2',
            source_raw: { titel: 'Saknad lag 2' },
            match_status: 'CATALOG_REQUEST_PENDING',
          },
          {
            row_index: 2,
            source_titel: 'Saknad lag 3',
            source_sfs_nummer: 'AFS 2024:3',
            source_raw: { titel: 'Saknad lag 3' },
            match_status: 'CATALOG_REQUEST_PENDING',
          },
        ],
      },
    },
    include: { rows: { orderBy: { row_index: 'asc' } } },
  })
  row1Id = importRow.rows[0]!.id
  row2Id = importRow.rows[1]!.id
  row3Id = importRow.rows[2]!.id

  // Seed three CatalogIngestRequest rows in different age buckets to exercise
  // the SLA-tier sort order in listPendingCatalogRequests.
  // row1 → 30 hours old (BREACHED)
  // row2 → 18 hours old (warning)
  // row3 → 2 hours old (within budget)
  const now = Date.now()
  const breachReq = await prisma.catalogIngestRequest.create({
    data: {
      workspace_id: workspaceId,
      import_row_id: row1Id,
      requested_by_user_id: workspaceUserId,
      created_at: new Date(now - 30 * 60 * 60 * 1000),
    },
  })
  pendingRequestId = breachReq.id

  const warnReq = await prisma.catalogIngestRequest.create({
    data: {
      workspace_id: workspaceId,
      import_row_id: row2Id,
      requested_by_user_id: workspaceUserId,
      created_at: new Date(now - 18 * 60 * 60 * 1000),
    },
  })
  secondRequestId = warnReq.id

  const freshReq = await prisma.catalogIngestRequest.create({
    data: {
      workspace_id: workspaceId,
      import_row_id: row3Id,
      requested_by_user_id: workspaceUserId,
      created_at: new Date(now - 2 * 60 * 60 * 1000),
    },
  })
  rejectableRequestId = freshReq.id
})

afterAll(async () => {
  await cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: admin authenticated as the test admin user.
  mockGetAdminSession.mockResolvedValue({
    email: `${TEST_PREFIX}admin@laglig.se`,
  })
  mockSendEmail.mockResolvedValue({ success: true })
})

// ============================================================================
// listPendingCatalogRequests
// ============================================================================

describe('listPendingCatalogRequests', () => {
  test('returns admin error when no session', async () => {
    mockGetAdminSession.mockResolvedValue(null)
    const result = await listPendingCatalogRequests()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Ej autentiserad')
  })

  test('returns rows sorted by age ascending (oldest first)', async () => {
    const result = await listPendingCatalogRequests({ status: 'pending' })
    expect(result.success).toBe(true)
    const ourRequests = result.data!.requests.filter(
      (r) => r.workspace.id === workspaceId
    )
    expect(ourRequests).toHaveLength(3)
    expect(ourRequests[0]?.id).toBe(pendingRequestId) // 30h — oldest
    expect(ourRequests[1]?.id).toBe(secondRequestId) // 18h
    expect(ourRequests[2]?.id).toBe(rejectableRequestId) // 2h — newest
  })

  test('counts include breach count for PENDING + age > 24h', async () => {
    const result = await listPendingCatalogRequests({ status: 'pending' })
    expect(result.success).toBe(true)
    // Note: counts cover ALL workspaces in the time window (admin view).
    // We can only assert OUR contributions are included — breached >= 1
    // (the 30h-old request) and pending >= 3.
    expect(result.data!.counts.pending).toBeGreaterThanOrEqual(3)
    expect(result.data!.counts.breached).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// fulfillCatalogRequest
// ============================================================================

describe('fulfillCatalogRequest', () => {
  test('rejects when admin not authenticated', async () => {
    mockGetAdminSession.mockResolvedValue(null)
    const result = await fulfillCatalogRequest({
      requestId: pendingRequestId,
      fulfilledWithDocumentId: realDocId,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Ej autentiserad')
  })

  test('rejects when LegalDocument id does not exist', async () => {
    const result = await fulfillCatalogRequest({
      requestId: pendingRequestId,
      fulfilledWithDocumentId: '00000000-0000-0000-0000-000000000000',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Inget dokument')
  })

  test('happy path: flips request → FULFILLED, rematches row, sends email, logs activity', async () => {
    const result = await fulfillCatalogRequest({
      requestId: pendingRequestId,
      fulfilledWithDocumentId: realDocId,
      adminNote: 'Ingestat från staging',
    })
    expect(result.success).toBe(true)

    // Request flipped + handler set
    const persistedRequest = await prisma.catalogIngestRequest.findUnique({
      where: { id: pendingRequestId },
    })
    expect(persistedRequest?.status).toBe('FULFILLED')
    expect(persistedRequest?.handler_user_id).toBe(adminUserId)
    expect(persistedRequest?.fulfilled_with_document_id).toBe(realDocId)
    expect(persistedRequest?.admin_note).toBe('Ingestat från staging')
    expect(persistedRequest?.fulfilled_at).not.toBeNull()

    // Row auto-rematched
    const persistedRow = await prisma.lawListImportRow.findUnique({
      where: { id: row1Id },
    })
    expect(persistedRow?.match_status).toBe('CATALOG_REQUEST_FULFILLED')
    expect(persistedRow?.matched_document_id).toBe(realDocId)
    expect(persistedRow?.confidence_score).toBe(1.0)

    // Email sent (mocked)
    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail.mock.calls[0]?.[0].to).toBe(
      `${TEST_PREFIX}user@test.com`
    )

    // Activity log written on the originating workspace
    const activity = await prisma.activityLog.findFirst({
      where: {
        entity_id: pendingRequestId,
        action: 'catalog_request.fulfilled',
      },
    })
    expect(activity).not.toBeNull()
    expect(activity?.workspace_id).toBe(workspaceId)
  })

  test('idempotency — re-fulfilling FULFILLED request is a no-op success (no double-email)', async () => {
    // Reset the email mock so we can detect an unwanted re-send.
    mockSendEmail.mockClear()

    const result = await fulfillCatalogRequest({
      requestId: pendingRequestId,
      fulfilledWithDocumentId: realDocId,
    })
    expect(result.success).toBe(true)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

// ============================================================================
// rejectCatalogRequest
// ============================================================================

describe('rejectCatalogRequest', () => {
  test('rejects PENDING request → REJECTED, no email, no row mutation', async () => {
    mockSendEmail.mockClear()
    const result = await rejectCatalogRequest({
      requestId: rejectableRequestId,
      adminNote: 'Dubblett av annan förfrågan',
    })
    expect(result.success).toBe(true)

    const persistedRequest = await prisma.catalogIngestRequest.findUnique({
      where: { id: rejectableRequestId },
    })
    expect(persistedRequest?.status).toBe('REJECTED')
    expect(persistedRequest?.handler_user_id).toBe(adminUserId)
    expect(persistedRequest?.admin_note).toBe('Dubblett av annan förfrågan')
    expect(persistedRequest?.rejected_at).not.toBeNull()

    // Row UNCHANGED (per AC 21 — rejection doesn't auto-flip the row)
    const persistedRow = await prisma.lawListImportRow.findUnique({
      where: { id: row3Id },
    })
    expect(persistedRow?.match_status).toBe('CATALOG_REQUEST_PENDING')

    // No email
    expect(mockSendEmail).not.toHaveBeenCalled()

    // Activity log written
    const activity = await prisma.activityLog.findFirst({
      where: {
        entity_id: rejectableRequestId,
        action: 'catalog_request.rejected',
      },
    })
    expect(activity).not.toBeNull()
  })

  test('idempotency — re-rejecting REJECTED request is a no-op success', async () => {
    const result = await rejectCatalogRequest({
      requestId: rejectableRequestId,
    })
    expect(result.success).toBe(true)
  })

  test('refuses when status is not PENDING (e.g., already FULFILLED)', async () => {
    const result = await rejectCatalogRequest({ requestId: pendingRequestId })
    expect(result.success).toBe(false)
    expect(result.error).toContain('väntande')
  })
})

// ============================================================================
// getCatalogRequestPipCount
// ============================================================================

describe('getCatalogRequestPipCount', () => {
  test('returns admin error when no session', async () => {
    mockGetAdminSession.mockResolvedValue(null)
    const result = await getCatalogRequestPipCount()
    expect(result.success).toBe(false)
  })

  test('returns pending + breached counts', async () => {
    // After previous tests: pendingRequest is FULFILLED, rejectable is REJECTED,
    // so only secondRequest remains PENDING (18h old, NOT breached at 24h gate).
    const result = await getCatalogRequestPipCount()
    expect(result.success).toBe(true)
    expect(result.data!.pending).toBeGreaterThanOrEqual(1)
    // Test workspace's only remaining PENDING is 18h old < 24h breach gate.
    // Other workspaces in the DB might have breached rows; the assertion is
    // we get a non-negative integer.
    expect(result.data!.breached).toBeGreaterThanOrEqual(0)
  })
})

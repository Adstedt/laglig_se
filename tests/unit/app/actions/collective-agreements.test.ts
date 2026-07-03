/**
 * Story 7.5: uploadCollectiveAgreement + listCollectiveAgreements tests.
 *
 * Asserts the security contract (workspace scoping from ctx, employees:manage
 * on the mutation / employees:view on the read), upload validation (PDF only,
 * ≤25MB, Namn required, typ mapping ARB/TJM/null, period ordering), the
 * WorkspaceFile path (category AVTAL, extraction_status PENDING self-queue),
 * the CollectiveAgreement row shape, and the FIRST-upload CompanyProfile sync
 * (scoped in-ctx update + shared completeness recompute — never the
 * workspace:settings-gated action; not on second upload; never overwriting an
 * existing collective_agreement_name).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { WorkspaceContext } from '@/lib/auth/workspace-context'
import type { Permission } from '@/lib/auth/permissions'

const mockFileFindFirst = vi.fn()
const mockFileCreate = vi.fn()
const mockAgreementCreate = vi.fn()
const mockAgreementFindMany = vi.fn()
const mockProfileFindUnique = vi.fn()
const mockProfileUpdate = vi.fn()
const mockProfileCreate = vi.fn()
const mockTransaction = vi.fn()
const mockRevalidatePath = vi.fn()
const mockStorageUpload = vi.fn()
const mockAssertQuota = vi.fn()
const mockCalculateCompleteness = vi.fn()

const txClient = {
  companyProfile: {
    findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    update: (...args: unknown[]) => mockProfileUpdate(...args),
    create: (...args: unknown[]) => mockProfileCreate(...args),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      findFirst: (...args: unknown[]) => mockFileFindFirst(...args),
      create: (...args: unknown[]) => mockFileCreate(...args),
    },
    collectiveAgreement: {
      create: (...args: unknown[]) => mockAgreementCreate(...args),
      findMany: (...args: unknown[]) => mockAgreementFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
      }),
    },
  }),
}))

// vi.mock factories are hoisted above module-scope class declarations, so the
// error classes must be hoisted too.
const { MockStorageQuotaExceededError, MockWorkspaceAccessError } = vi.hoisted(
  () => {
    class MockStorageQuotaExceededError extends Error {
      currentBytes: number
      limitBytes: number
      constructor(currentBytes: number, limitBytes: number) {
        super('quota exceeded')
        this.currentBytes = currentBytes
        this.limitBytes = limitBytes
      }
    }
    class MockWorkspaceAccessError extends Error {
      code: string
      constructor(message: string, code: string) {
        super(message)
        this.code = code
      }
    }
    return { MockStorageQuotaExceededError, MockWorkspaceAccessError }
  }
)

vi.mock('@/lib/usage/storage', () => ({
  assertWithinStorageQuota: (...args: unknown[]) => mockAssertQuota(...args),
  formatBytesSwedish: (bytes: number) => `${bytes} B`,
  StorageQuotaExceededError: MockStorageQuotaExceededError,
}))

vi.mock('@/lib/documents/extractable-mime', () => ({
  isExtractableMimeType: (mime: string) => mime === 'application/pdf',
}))

vi.mock('@/lib/profile-completeness', () => ({
  calculateProfileCompleteness: (...args: unknown[]) =>
    mockCalculateCompleteness(...args),
}))

const WORKSPACE_ID = 'ws-0001'

let lastRequiredPermission: Permission | undefined

vi.mock('@/lib/auth/workspace-context', () => ({
  WorkspaceAccessError: MockWorkspaceAccessError,
  withWorkspace: vi.fn(
    async (
      cb: (_ctx: WorkspaceContext) => Promise<unknown>,
      requiredPermission?: Permission
    ) => {
      lastRequiredPermission = requiredPermission
      const ctx = {
        userId: 'user-1',
        workspaceId: WORKSPACE_ID,
        workspaceName: 'Acme',
        workspaceSlug: 'acme',
        role: 'HR_MANAGER',
        hasPermission: () => true,
      } as unknown as WorkspaceContext
      return cb(ctx)
    }
  ),
}))

import {
  uploadCollectiveAgreement,
  listCollectiveAgreements,
} from '@/app/actions/collective-agreements'

function makePdf(name = 'byggavtalet.pdf', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' })
}

function makeFormData(
  overrides: {
    file?: File | null
    name?: string
    personel_type?: string
    effective_from?: string
    effective_to?: string
  } = {}
): FormData {
  const fd = new FormData()
  const file = overrides.file === null ? null : (overrides.file ?? makePdf())
  if (file) fd.set('file', file)
  fd.set('name', overrides.name ?? 'Byggnads Kollektivavtal 2024')
  fd.set('personel_type', overrides.personel_type ?? 'ARB')
  fd.set('effective_from', overrides.effective_from ?? '')
  fd.set('effective_to', overrides.effective_to ?? '')
  return fd
}

const CREATED_AGREEMENT = {
  id: 'agr-1',
  name: 'Byggnads Kollektivavtal 2024',
  personel_type: 'ARB',
  status: 'PENDING',
  effective_from: null,
  effective_to: null,
  uploaded_by: 'user-1',
  created_at: new Date('2026-07-03T10:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lastRequiredPermission = undefined

  mockFileFindFirst.mockResolvedValue(null)
  mockFileCreate.mockResolvedValue({ id: 'file-1' })
  mockAgreementCreate.mockResolvedValue(CREATED_AGREEMENT)
  mockAgreementFindMany.mockResolvedValue([])
  mockStorageUpload.mockResolvedValue({ error: null })
  mockAssertQuota.mockResolvedValue({ warning: undefined })
  mockCalculateCompleteness.mockReturnValue(0)
  // $transaction(cb) → run the callback against the tx stand-in.
  mockTransaction.mockImplementation(
    async (cb: (_tx: typeof txClient) => Promise<unknown>) => cb(txClient)
  )
  // Default: profile exists, no agreement yet (FIRST upload).
  mockProfileFindUnique.mockResolvedValue({
    workspace_id: WORKSPACE_ID,
    has_collective_agreement: false,
    collective_agreement_name: null,
    profile_completeness: 10,
  })
  mockProfileUpdate.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve({
        workspace_id: WORKSPACE_ID,
        has_collective_agreement: true,
        collective_agreement_name: null,
        profile_completeness: 10,
        ...args.data,
      })
  )
  mockProfileCreate.mockImplementation((args: { data: object }) =>
    Promise.resolve({ profile_completeness: 0, ...args.data })
  )
})

// ===========================================================================
// uploadCollectiveAgreement — validation
// ===========================================================================

describe('uploadCollectiveAgreement — validation', () => {
  test('rejects missing file', async () => {
    const result = await uploadCollectiveAgreement(makeFormData({ file: null }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('Ingen fil vald')
    expect(mockFileCreate).not.toHaveBeenCalled()
  })

  test('rejects non-PDF files', async () => {
    const txt = new File(['hej'], 'avtal.txt', { type: 'text/plain' })
    const result = await uploadCollectiveAgreement(makeFormData({ file: txt }))
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Endast PDF-filer kan laddas upp som kollektivavtal.'
    )
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  test('rejects files over 25MB', async () => {
    const big = makePdf('stor.pdf', 25 * 1024 * 1024 + 1)
    const result = await uploadCollectiveAgreement(makeFormData({ file: big }))
    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen är för stor (max 25MB)')
  })

  test('rejects empty Namn', async () => {
    const result = await uploadCollectiveAgreement(
      makeFormData({ name: '   ' })
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Namn krävs.')
  })

  test('rejects a giltighetsperiod that ends before it starts', async () => {
    const result = await uploadCollectiveAgreement(
      makeFormData({ effective_from: '2026-01-01', effective_to: '2025-01-01' })
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Giltighetsperiodens slutdatum måste vara efter startdatumet.'
    )
  })

  test('rejects duplicate filename (root-folder dedupe, workspace-scoped)', async () => {
    mockFileFindFirst.mockResolvedValue({ id: 'existing' })
    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(false)
    expect(result.error).toBe('En fil med samma namn finns redan i Filer.')
    expect(mockFileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace_id: WORKSPACE_ID }),
      })
    )
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  test('storage quota exceeded → STORAGE_QUOTA_EXCEEDED code, no storage write', async () => {
    mockAssertQuota.mockRejectedValue(
      new MockStorageQuotaExceededError(900, 1000)
    )
    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(false)
    expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED')
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  test('storage upload error → friendly error, no DB rows', async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: 'boom' } })
    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte ladda upp filen')
    expect(mockFileCreate).not.toHaveBeenCalled()
    expect(mockAgreementCreate).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// uploadCollectiveAgreement — happy path
// ===========================================================================

describe('uploadCollectiveAgreement — happy path', () => {
  test('is gated employees:manage (never workspace:settings)', async () => {
    await uploadCollectiveAgreement(makeFormData())
    expect(lastRequiredPermission).toBe('employees:manage')
  })

  test('stores the WorkspaceFile with category AVTAL + extraction_status PENDING (self-queues for the cron)', async () => {
    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(true)

    expect(mockFileCreate).toHaveBeenCalledTimes(1)
    const fileData = (
      mockFileCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data
    expect(fileData.workspace_id).toBe(WORKSPACE_ID)
    expect(fileData.uploaded_by).toBe('user-1')
    expect(fileData.category).toBe('AVTAL')
    expect(fileData.extraction_status).toBe('PENDING')
    expect(fileData.mime_type).toBe('application/pdf')
    expect(fileData.content_hash).toEqual(expect.any(String))
    expect(String(fileData.storage_path)).toContain(`${WORKSPACE_ID}/files/`)
  })

  test('creates the CollectiveAgreement row (FK to the file, ctx user, PENDING, typ + period)', async () => {
    const result = await uploadCollectiveAgreement(
      makeFormData({ effective_from: '2024-04-01', effective_to: '2025-03-31' })
    )
    expect(result.success).toBe(true)

    const agrData = (
      mockAgreementCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data
    expect(agrData.workspace_id).toBe(WORKSPACE_ID)
    expect(agrData.name).toBe('Byggnads Kollektivavtal 2024')
    expect(agrData.personel_type).toBe('ARB')
    expect(agrData.uploaded_by).toBe('user-1')
    expect(agrData.status).toBe('PENDING')
    expect(agrData.workspace_file_id).toBe(
      (mockFileCreate.mock.calls[0]![0] as { data: { id: string } }).data.id
    )
    expect(agrData.effective_from).toEqual(new Date('2024-04-01T00:00:00.000Z'))
    expect(agrData.effective_to).toEqual(new Date('2025-03-31T00:00:00.000Z'))
  })

  test.each([
    ['ARB', 'ARB'],
    ['TJM', 'TJM'],
    ['', null], // Övrigt
  ])('typ mapping: form value %j → personel_type %j', async (input, stored) => {
    await uploadCollectiveAgreement(makeFormData({ personel_type: input }))
    const agrData = (
      mockAgreementCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data
    expect(agrData.personel_type).toBe(stored)
  })

  test('revalidates /personalregister + /settings and returns the serialized list item', async () => {
    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
    expect(result.data).toMatchObject({
      id: 'agr-1',
      name: 'Byggnads Kollektivavtal 2024',
      personel_type: 'ARB',
      status: 'PENDING',
      effective_from: null,
      effective_to: null,
      assignedEmployeeCount: 0,
    })
    expect(result.data!.created_at).toBe('2026-07-03T10:00:00.000Z')
  })
})

// ===========================================================================
// uploadCollectiveAgreement — first-upload CompanyProfile sync (PO correction)
// ===========================================================================

describe('uploadCollectiveAgreement — first-upload CompanyProfile sync', () => {
  test('FIRST upload: sets has_collective_agreement + collective_agreement_name via scoped update', async () => {
    await uploadCollectiveAgreement(makeFormData())

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
        data: {
          has_collective_agreement: true,
          collective_agreement_name: 'Byggnads Kollektivavtal 2024',
        },
      })
    )
  })

  test('recomputes profile_completeness with the shared helper when the score changed', async () => {
    mockCalculateCompleteness.mockReturnValue(20)

    await uploadCollectiveAgreement(makeFormData())

    expect(mockCalculateCompleteness).toHaveBeenCalled()
    // Second update writes the recomputed score (stored was 10).
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
        data: { profile_completeness: 20 },
      })
    )
  })

  test('NOT on second upload: flag already true → no profile writes', async () => {
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Gammalt avtal',
      profile_completeness: 30,
    })

    const result = await uploadCollectiveAgreement(makeFormData())
    expect(result.success).toBe(true)
    expect(mockProfileUpdate).not.toHaveBeenCalled()
    expect(mockProfileCreate).not.toHaveBeenCalled()
  })

  test('never overwrites an existing collective_agreement_name', async () => {
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: false,
      collective_agreement_name: 'Redan ifyllt avtal',
      profile_completeness: 10,
    })

    await uploadCollectiveAgreement(makeFormData())

    const updateData = (
      mockProfileUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }
    ).data
    expect(updateData.has_collective_agreement).toBe(true)
    expect(updateData).not.toHaveProperty('collective_agreement_name')
  })

  test('missing profile row → lazily created with the flag + name set', async () => {
    mockProfileFindUnique.mockResolvedValue(null)

    await uploadCollectiveAgreement(makeFormData())

    expect(mockProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          company_name: 'Acme',
          has_collective_agreement: true,
          collective_agreement_name: 'Byggnads Kollektivavtal 2024',
        }),
      })
    )
  })

  test('fail-safe: a profile-sync error never fails the upload', async () => {
    mockTransaction.mockRejectedValue(new Error('profile table locked'))

    const result = await uploadCollectiveAgreement(makeFormData())

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ id: 'agr-1' })
  })
})

// ===========================================================================
// listCollectiveAgreements
// ===========================================================================

describe('listCollectiveAgreements', () => {
  test('is gated employees:view and workspace-scoped', async () => {
    await listCollectiveAgreements()
    expect(lastRequiredPermission).toBe('employees:view')
    expect(mockAgreementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
      })
    )
  })

  test('serializes the full list shape (superset of 7.3 options) incl. assigned-employee count', async () => {
    mockAgreementFindMany.mockResolvedValue([
      {
        id: 'agr-1',
        name: 'Byggavtalet',
        personel_type: 'ARB',
        status: 'READY',
        effective_from: new Date('2024-04-01T00:00:00.000Z'),
        effective_to: null,
        uploaded_by: 'user-1',
        created_at: new Date('2026-07-01T08:00:00.000Z'),
        _count: { employees: 3 },
      },
    ])

    const result = await listCollectiveAgreements()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      {
        id: 'agr-1',
        name: 'Byggavtalet',
        personel_type: 'ARB',
        status: 'READY',
        effective_from: '2024-04-01',
        effective_to: null,
        uploaded_by: 'user-1',
        created_at: '2026-07-01T08:00:00.000Z',
        assignedEmployeeCount: 3,
      },
    ])
  })

  test('returns a friendly error on failure', async () => {
    mockAgreementFindMany.mockRejectedValue(new Error('db down'))
    const result = await listCollectiveAgreements()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte hämta kollektivavtal.')
  })
})

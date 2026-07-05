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
 *
 * Story 7.6 adds: updateCollectiveAgreement (compound-where write + profile
 * repoint on rename), deleteCollectiveAgreement (chunks → agreement → file
 * row → storage object, profile-honesty matrix, fail-safe storage removal),
 * assignCollectiveAgreementBulk + previewBulkAssignCount (workspace-verified
 * targeting incl. cross-workspace group/agreement rejection).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { WorkspaceContext } from '@/lib/auth/workspace-context'
import type { Permission } from '@/lib/auth/permissions'

const mockFileFindFirst = vi.fn()
const mockFileCreate = vi.fn()
const mockFileDelete = vi.fn()
const mockAgreementCreate = vi.fn()
const mockAgreementFindFirst = vi.fn()
const mockAgreementFindMany = vi.fn()
const mockAgreementUpdateMany = vi.fn()
const mockAgreementDelete = vi.fn()
const mockChunkDeleteMany = vi.fn()
const mockEmployeeUpdateMany = vi.fn()
const mockEmployeeCount = vi.fn()
const mockGroupFindFirst = vi.fn()
const mockProfileFindUnique = vi.fn()
const mockProfileUpdate = vi.fn()
const mockProfileCreate = vi.fn()
const mockTransaction = vi.fn()
const mockRevalidatePath = vi.fn()
const mockStorageUpload = vi.fn()
const mockStorageRemove = vi.fn()
const mockAssertQuota = vi.fn()
const mockCalculateCompleteness = vi.fn()

const txClient = {
  companyProfile: {
    findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    update: (...args: unknown[]) => mockProfileUpdate(...args),
    create: (...args: unknown[]) => mockProfileCreate(...args),
  },
  contentChunk: {
    deleteMany: (...args: unknown[]) => mockChunkDeleteMany(...args),
  },
  collectiveAgreement: {
    updateMany: (...args: unknown[]) => mockAgreementUpdateMany(...args),
    delete: (...args: unknown[]) => mockAgreementDelete(...args),
    findMany: (...args: unknown[]) => mockAgreementFindMany(...args),
  },
  workspaceFile: {
    delete: (...args: unknown[]) => mockFileDelete(...args),
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
      findFirst: (...args: unknown[]) => mockAgreementFindFirst(...args),
      findMany: (...args: unknown[]) => mockAgreementFindMany(...args),
    },
    employee: {
      updateMany: (...args: unknown[]) => mockEmployeeUpdateMany(...args),
      count: (...args: unknown[]) => mockEmployeeCount(...args),
    },
    employeeGroup: {
      findFirst: (...args: unknown[]) => mockGroupFindFirst(...args),
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
        remove: (...args: unknown[]) => mockStorageRemove(...args),
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
  updateCollectiveAgreement,
  deleteCollectiveAgreement,
  assignCollectiveAgreementBulk,
  previewBulkAssignCount,
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

/** Full record satisfying both the verify select and the LIST_ITEM_SELECT refetch. */
const FULL_AGREEMENT = {
  id: 'agr-1',
  name: 'Byggavtalet 2024',
  personel_type: 'ARB',
  status: 'READY',
  effective_from: null,
  effective_to: null,
  uploaded_by: 'user-1',
  created_at: new Date('2026-07-01T08:00:00.000Z'),
  _count: { employees: 3 },
  workspace_file_id: 'file-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lastRequiredPermission = undefined

  mockFileFindFirst.mockResolvedValue(null)
  mockFileCreate.mockResolvedValue({ id: 'file-1' })
  mockFileDelete.mockResolvedValue({})
  mockAgreementCreate.mockResolvedValue(CREATED_AGREEMENT)
  mockAgreementFindFirst.mockResolvedValue(FULL_AGREEMENT)
  mockAgreementFindMany.mockResolvedValue([])
  mockAgreementUpdateMany.mockResolvedValue({ count: 1 })
  mockAgreementDelete.mockResolvedValue({})
  mockChunkDeleteMany.mockResolvedValue({ count: 4 })
  mockEmployeeUpdateMany.mockResolvedValue({ count: 3 })
  mockEmployeeCount.mockResolvedValue(3)
  mockGroupFindFirst.mockResolvedValue({ id: 'grp-1' })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({ error: null })
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

// ===========================================================================
// Story 7.6: updateCollectiveAgreement
// ===========================================================================

const UPDATE_INPUT = {
  name: 'Byggavtalet 2025',
  personel_type: 'ARB' as const,
  effective_from: '2025-04-01',
  effective_to: '2026-03-31',
}

describe('updateCollectiveAgreement', () => {
  test('is gated employees:manage', async () => {
    await updateCollectiveAgreement('agr-1', UPDATE_INPUT)
    expect(lastRequiredPermission).toBe('employees:manage')
  })

  test('rejects invalid input (empty Namn) before touching the DB', async () => {
    const result = await updateCollectiveAgreement('agr-1', {
      ...UPDATE_INPUT,
      name: '   ',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Namn krävs.')
    expect(mockAgreementFindFirst).not.toHaveBeenCalled()
    expect(mockAgreementUpdateMany).not.toHaveBeenCalled()
  })

  test('rejects a period that ends before it starts', async () => {
    const result = await updateCollectiveAgreement('agr-1', {
      ...UPDATE_INPUT,
      effective_from: '2026-01-01',
      effective_to: '2025-01-01',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Giltighetsperiodens slutdatum måste vara efter startdatumet.'
    )
  })

  test('cross-workspace agreement id is rejected — verify uses compound where, no write happens', async () => {
    mockAgreementFindFirst.mockResolvedValue(null)

    const result = await updateCollectiveAgreement('agr-other-ws', UPDATE_INPUT)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kollektivavtalet hittades inte.')
    expect(mockAgreementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agr-other-ws', workspace_id: WORKSPACE_ID },
      })
    )
    expect(mockAgreementUpdateMany).not.toHaveBeenCalled()
  })

  test('writes via compound where (workspace filter ON the mutation) with UTC dates + typ mapping', async () => {
    const result = await updateCollectiveAgreement('agr-1', UPDATE_INPUT)

    expect(result.success).toBe(true)
    expect(mockAgreementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'agr-1', workspace_id: WORKSPACE_ID },
      data: {
        name: 'Byggavtalet 2025',
        personel_type: 'ARB',
        effective_from: new Date('2025-04-01T00:00:00.000Z'),
        effective_to: new Date('2026-03-31T00:00:00.000Z'),
      },
    })
  })

  test('Övrigt clears personel_type and empty period clears the dates', async () => {
    await updateCollectiveAgreement('agr-1', {
      name: 'Byggavtalet 2024',
      personel_type: null,
      effective_from: null,
      effective_to: null,
    })
    expect(mockAgreementUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Byggavtalet 2024',
          personel_type: null,
          effective_from: null,
          effective_to: null,
        },
      })
    )
  })

  test('returns the refreshed serialized list item and revalidates both surfaces', async () => {
    mockAgreementFindFirst
      .mockResolvedValueOnce({ id: 'agr-1', name: 'Byggavtalet 2024' })
      .mockResolvedValueOnce({
        ...FULL_AGREEMENT,
        name: 'Byggavtalet 2025',
        effective_from: new Date('2025-04-01T00:00:00.000Z'),
        effective_to: new Date('2026-03-31T00:00:00.000Z'),
      })

    const result = await updateCollectiveAgreement('agr-1', UPDATE_INPUT)

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      id: 'agr-1',
      name: 'Byggavtalet 2025',
      effective_from: '2025-04-01',
      effective_to: '2026-03-31',
      assignedEmployeeCount: 3,
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
  })

  test('renaming the profile-named agreement repoints CompanyProfile (scoped write + recompute)', async () => {
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Byggavtalet 2024', // matches existing.name
      profile_completeness: 30,
    })
    mockCalculateCompleteness.mockReturnValue(30)

    await updateCollectiveAgreement('agr-1', UPDATE_INPUT)

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
        data: { collective_agreement_name: 'Byggavtalet 2025' },
      })
    )
  })

  test('no profile write when the profile name is a different agreement', async () => {
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Tjänstemannaavtalet',
      profile_completeness: 30,
    })

    await updateCollectiveAgreement('agr-1', UPDATE_INPUT)

    expect(mockProfileUpdate).not.toHaveBeenCalled()
  })

  test('no profile lookup at all when the name is unchanged', async () => {
    await updateCollectiveAgreement('agr-1', {
      ...UPDATE_INPUT,
      name: 'Byggavtalet 2024', // === existing.name
    })
    expect(mockProfileFindUnique).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Story 7.6: deleteCollectiveAgreement (full cascade)
// ===========================================================================

const BACKING_FILE = {
  id: 'file-1',
  storage_path: `${WORKSPACE_ID}/files/file-1/byggavtalet.pdf`,
}

describe('deleteCollectiveAgreement', () => {
  test('is gated employees:manage', async () => {
    await deleteCollectiveAgreement('agr-1')
    expect(lastRequiredPermission).toBe('employees:manage')
  })

  test('cross-workspace agreement id is rejected — nothing is deleted', async () => {
    mockAgreementFindFirst.mockResolvedValue(null)

    const result = await deleteCollectiveAgreement('agr-other-ws')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kollektivavtalet hittades inte.')
    expect(mockChunkDeleteMany).not.toHaveBeenCalled()
    expect(mockAgreementDelete).not.toHaveBeenCalled()
    expect(mockFileDelete).not.toHaveBeenCalled()
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  test('chunk cleanup filter includes BOTH source_id and workspace_id (defense in depth)', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)

    await deleteCollectiveAgreement('agr-1')

    expect(mockChunkDeleteMany).toHaveBeenCalledWith({
      where: {
        source_type: 'COLLECTIVE_AGREEMENT',
        source_id: 'agr-1',
        workspace_id: WORKSPACE_ID,
      },
    })
  })

  test('deletion order: chunks → agreement → file row → storage object', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)

    const result = await deleteCollectiveAgreement('agr-1')

    expect(result.success).toBe(true)
    const chunkOrder = mockChunkDeleteMany.mock.invocationCallOrder[0]!
    const agreementOrder = mockAgreementDelete.mock.invocationCallOrder[0]!
    const fileOrder = mockFileDelete.mock.invocationCallOrder[0]!
    const storageOrder = mockStorageRemove.mock.invocationCallOrder[0]!
    expect(chunkOrder).toBeLessThan(agreementOrder)
    expect(agreementOrder).toBeLessThan(fileOrder)
    expect(fileOrder).toBeLessThan(storageOrder)

    expect(mockAgreementDelete).toHaveBeenCalledWith({ where: { id: 'agr-1' } })
    expect(mockFileDelete).toHaveBeenCalledWith({ where: { id: 'file-1' } })
    expect(mockStorageRemove).toHaveBeenCalledWith([BACKING_FILE.storage_path])
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
  })

  test('the backing-file lookup is workspace-verified; a foreign file row is left alone', async () => {
    mockFileFindFirst.mockResolvedValue(null) // not found in ctx workspace

    const result = await deleteCollectiveAgreement('agr-1')

    expect(result.success).toBe(true)
    expect(mockFileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'file-1',
          workspace_id: WORKSPACE_ID,
        }),
      })
    )
    expect(mockAgreementDelete).toHaveBeenCalled()
    expect(mockFileDelete).not.toHaveBeenCalled()
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  test('an agreement without a backing file skips the file + storage legs', async () => {
    mockAgreementFindFirst.mockResolvedValue({
      ...FULL_AGREEMENT,
      workspace_file_id: null,
    })

    const result = await deleteCollectiveAgreement('agr-1')

    expect(result.success).toBe(true)
    expect(mockFileFindFirst).not.toHaveBeenCalled()
    expect(mockFileDelete).not.toHaveBeenCalled()
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  test('storage removal is fail-safe: a failed remove logs but the delete still succeeds', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)
    mockStorageRemove.mockRejectedValue(new Error('storage down'))

    const result = await deleteCollectiveAgreement('agr-1')

    expect(result.success).toBe(true)
  })

  test('profile honesty — deleting the LAST agreement clears flag + name', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)
    mockAgreementFindMany.mockResolvedValue([]) // none remain after the delete
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Byggavtalet 2024',
      profile_completeness: 30,
    })
    mockCalculateCompleteness.mockReturnValue(20)

    await deleteCollectiveAgreement('agr-1')

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
        data: {
          has_collective_agreement: false,
          collective_agreement_name: null,
        },
      })
    )
    // Completeness recomputed with the shared helper (score changed 30 → 20).
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { profile_completeness: 20 },
      })
    )
  })

  test('profile honesty — deleting the PROFILE-NAMED agreement repoints to a remaining one', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)
    mockAgreementFindMany.mockResolvedValue([{ name: 'Tjänstemannaavtalet' }])
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Byggavtalet 2024', // the deleted one
      profile_completeness: 30,
    })
    mockCalculateCompleteness.mockReturnValue(30)

    await deleteCollectiveAgreement('agr-1')

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspace_id: WORKSPACE_ID },
        data: { collective_agreement_name: 'Tjänstemannaavtalet' },
      })
    )
    // The flag stays true — agreements remain.
    const wroteFlagFalse = mockProfileUpdate.mock.calls.some(
      (call) =>
        (call[0] as { data: Record<string, unknown> }).data
          .has_collective_agreement === false
    )
    expect(wroteFlagFalse).toBe(false)
  })

  test('profile honesty — deleting a NON-named agreement (others remain) writes nothing', async () => {
    mockFileFindFirst.mockResolvedValue(BACKING_FILE)
    mockAgreementFindMany.mockResolvedValue([{ name: 'Tjänstemannaavtalet' }])
    mockProfileFindUnique.mockResolvedValue({
      workspace_id: WORKSPACE_ID,
      has_collective_agreement: true,
      collective_agreement_name: 'Tjänstemannaavtalet',
      profile_completeness: 30,
    })

    await deleteCollectiveAgreement('agr-1')

    expect(mockProfileUpdate).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Story 7.6: bulk assignment + preview
// ===========================================================================

describe('assignCollectiveAgreementBulk', () => {
  test('is gated employees:manage', async () => {
    await assignCollectiveAgreementBulk('agr-1', {
      kind: 'personel_type',
      value: 'ARB',
    })
    expect(lastRequiredPermission).toBe('employees:manage')
  })

  test('cross-workspace agreement id is rejected before any write', async () => {
    mockAgreementFindFirst.mockResolvedValue(null)

    const result = await assignCollectiveAgreementBulk('agr-other-ws', {
      kind: 'personel_type',
      value: 'ARB',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kollektivavtalet hittades inte.')
    expect(mockAgreementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'agr-other-ws', workspace_id: WORKSPACE_ID },
      })
    )
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
  })

  test('cross-workspace group id is rejected before any write', async () => {
    mockGroupFindFirst.mockResolvedValue(null)

    const result = await assignCollectiveAgreementBulk('agr-1', {
      kind: 'group',
      groupId: 'grp-other-ws',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Gruppen hittades inte.')
    expect(mockGroupFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'grp-other-ws', workspace_id: WORKSPACE_ID },
      })
    )
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
  })

  test('personaltyp targeting: compound workspace filter on the updateMany itself', async () => {
    const result = await assignCollectiveAgreementBulk('agr-1', {
      kind: 'personel_type',
      value: 'ARB',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ assigned: 3 })
    expect(mockEmployeeUpdateMany).toHaveBeenCalledWith({
      where: { workspace_id: WORKSPACE_ID, personel_type: 'ARB' },
      data: { collective_agreement_id: 'agr-1' },
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
  })

  test('group targeting: whole enhet, workspace-filtered', async () => {
    mockEmployeeUpdateMany.mockResolvedValue({ count: 5 })

    const result = await assignCollectiveAgreementBulk('agr-1', {
      kind: 'group',
      groupId: 'grp-1',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ assigned: 5 })
    expect(mockEmployeeUpdateMany).toHaveBeenCalledWith({
      where: { workspace_id: WORKSPACE_ID, group_id: 'grp-1' },
      data: { collective_agreement_id: 'agr-1' },
    })
  })

  test('malformed target is rejected', async () => {
    const result = await assignCollectiveAgreementBulk('agr-1', {
      kind: 'personel_type',
      value: 'CHEF',
    } as never)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Ogiltig indata')
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
  })
})

describe('previewBulkAssignCount', () => {
  test('is gated employees:manage and counts with the SAME compound filter as the mutation', async () => {
    const result = await previewBulkAssignCount({
      kind: 'personel_type',
      value: 'TJM',
    })

    expect(lastRequiredPermission).toBe('employees:manage')
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ count: 3 })
    expect(mockEmployeeCount).toHaveBeenCalledWith({
      where: { workspace_id: WORKSPACE_ID, personel_type: 'TJM' },
    })
  })

  test('group preview verifies group ownership; cross-workspace group is rejected', async () => {
    mockGroupFindFirst.mockResolvedValue(null)

    const result = await previewBulkAssignCount({
      kind: 'group',
      groupId: 'grp-other-ws',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Gruppen hittades inte.')
    expect(mockEmployeeCount).not.toHaveBeenCalled()
  })

  test('group preview counts the whole enhet, workspace-filtered', async () => {
    mockEmployeeCount.mockResolvedValue(7)

    const result = await previewBulkAssignCount({
      kind: 'group',
      groupId: 'grp-1',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ count: 7 })
    expect(mockEmployeeCount).toHaveBeenCalledWith({
      where: { workspace_id: WORKSPACE_ID, group_id: 'grp-1' },
    })
  })
})

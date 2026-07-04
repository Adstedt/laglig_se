/**
 * Story 7.2: Unit tests for employee group server actions.
 *
 * Asserts the security contract (every query filters/sets workspace_id from
 * ctx), the Int renumbering rule for reorder, that group deletion relies on
 * the FK's SetNull (never touches Employee), and that moves validate the
 * target group's workspace.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { WorkspaceContext } from '@/lib/auth/workspace-context'
import type { Permission } from '@/lib/auth/permissions'

const mockGroupFindMany = vi.fn()
const mockGroupFindFirst = vi.fn()
const mockGroupCreate = vi.fn()
const mockGroupUpdateMany = vi.fn()
const mockGroupDeleteMany = vi.fn()
const mockEmployeeUpdateMany = vi.fn()
const mockEmployeeFindFirst = vi.fn()
const mockEmployeeFindMany = vi.fn()
const mockEmployeeCreate = vi.fn()
const mockAgreementFindMany = vi.fn()
const mockAgreementFindFirst = vi.fn()
const mockTransaction = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeGroup: {
      findMany: (...args: unknown[]) => mockGroupFindMany(...args),
      findFirst: (...args: unknown[]) => mockGroupFindFirst(...args),
      create: (...args: unknown[]) => mockGroupCreate(...args),
      updateMany: (...args: unknown[]) => mockGroupUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockGroupDeleteMany(...args),
    },
    employee: {
      updateMany: (...args: unknown[]) => mockEmployeeUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockEmployeeFindFirst(...args),
      findMany: (...args: unknown[]) => mockEmployeeFindMany(...args),
      create: (...args: unknown[]) => mockEmployeeCreate(...args),
    },
    collectiveAgreement: {
      findMany: (...args: unknown[]) => mockAgreementFindMany(...args),
      findFirst: (...args: unknown[]) => mockAgreementFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// Story 7.3: deterministic crypto stand-in — the actions must route plaintext
// personnummer through encryptPersonnummer before store, and the repository
// decrypt path (getEmployeeRow → toView) uses the inverse. encrypt goes
// through a controllable vi.fn so the fail-closed branch (throw → friendly
// EMPLOYEE_ENCRYPTION_ERROR, no write, no logging) is testable (QA TEST-001).
const mockEncryptPersonnummer = vi.fn((value: string) => `enc:${value}`)
vi.mock('@/lib/employees/personnummer', () => ({
  PERSONNUMMER_MASK: '••••••-••••',
  encryptPersonnummer: (value: string) => mockEncryptPersonnummer(value),
  decryptPersonnummer: (cipher: string) => cipher.replace(/^enc:/, ''),
  maskPersonnummer: () => '••••••-••••',
}))

// Story 7.10: same deterministic crypto stand-in for salary — real
// normalizeSalary/maskSalary, `enc:`-prefixed encrypt/decrypt so both the write
// (action) and read (repository via getEmployeeRow) legs are inspectable.
vi.mock('@/lib/employees/salary', async () => {
  const actual = await vi.importActual<typeof import('@/lib/employees/salary')>(
    '@/lib/employees/salary'
  )
  return {
    ...actual,
    encryptSalary: (value: string) => `enc:${value}`,
    decryptSalary: (cipher: string) => cipher.replace(/^enc:/, ''),
  }
})

const WORKSPACE_ID = 'ws-0001'

let lastRequiredPermission: Permission | undefined

vi.mock('@/lib/auth/workspace-context', () => ({
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
        workspaceStatus: 'ACTIVE',
        role: 'HR_MANAGER',
        hasPermission: () => true,
      } as unknown as WorkspaceContext
      return cb(ctx)
    }
  ),
}))

import {
  getEmployeeGroups,
  createEmployeeGroup,
  renameEmployeeGroup,
  reorderEmployeeGroups,
  deleteEmployeeGroup,
  moveEmployeeToGroup,
  createEmployee,
  updateEmployee,
  getCollectiveAgreements,
  getEmployeesForChatContext,
} from '@/app/actions/employees'

beforeEach(() => {
  lastRequiredPermission = undefined
  mockGroupFindMany.mockReset()
  mockGroupFindFirst.mockReset()
  mockGroupCreate.mockReset()
  mockGroupUpdateMany.mockReset()
  mockGroupDeleteMany.mockReset()
  mockEmployeeUpdateMany.mockReset()
  mockEmployeeFindFirst.mockReset()
  mockEmployeeFindMany.mockReset()
  mockEmployeeCreate.mockReset()
  mockAgreementFindMany.mockReset()
  mockAgreementFindFirst.mockReset()
  mockTransaction.mockReset()
  mockRevalidatePath.mockReset()
  mockEncryptPersonnummer
    .mockReset()
    .mockImplementation((value: string) => `enc:${value}`)
  // Default: $transaction resolves the given array of operations.
  mockTransaction.mockImplementation((ops: Promise<unknown>[]) =>
    Promise.all(ops)
  )
})

describe('getEmployeeGroups', () => {
  test('filters by workspace_id, orders by position, gated employees:view', async () => {
    mockGroupFindMany.mockResolvedValueOnce([
      {
        id: 'grp-1',
        name: 'Lager',
        position: 0,
        _count: { employees: 3 },
      },
    ])

    const result = await getEmployeeGroups()

    expect(lastRequiredPermission).toBe('employees:view')
    const arg = mockGroupFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
      orderBy: unknown
    }
    expect(arg.where.workspace_id).toBe(WORKSPACE_ID)
    // created_at tiebreaker keeps ordering deterministic if positions were
    // ever duplicated (QA DATA-001).
    expect(arg.orderBy).toEqual([{ position: 'asc' }, { created_at: 'asc' }])
    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      { id: 'grp-1', name: 'Lager', position: 0, employeeCount: 3 },
    ])
  })
})

describe('createEmployeeGroup', () => {
  test('sets workspace_id from ctx and appends at end (max position + 1)', async () => {
    mockGroupFindFirst.mockResolvedValueOnce({ position: 4 })
    mockGroupCreate.mockResolvedValueOnce({
      id: 'grp-new',
      name: 'HR',
      position: 5,
    })

    const result = await createEmployeeGroup('HR')

    expect(lastRequiredPermission).toBe('employees:manage')
    const createArg = mockGroupCreate.mock.calls[0]?.[0] as {
      data: { workspace_id: string; name: string; position: number }
    }
    expect(createArg.data.workspace_id).toBe(WORKSPACE_ID)
    expect(createArg.data.name).toBe('HR')
    expect(createArg.data.position).toBe(5)
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('first group gets position 0', async () => {
    mockGroupFindFirst.mockResolvedValueOnce(null)
    mockGroupCreate.mockResolvedValueOnce({
      id: 'grp-new',
      name: 'Lager',
      position: 0,
    })

    await createEmployeeGroup('Lager')

    const createArg = mockGroupCreate.mock.calls[0]?.[0] as {
      data: { position: number }
    }
    expect(createArg.data.position).toBe(0)
  })

  test('rejects an empty name without touching the DB', async () => {
    const result = await createEmployeeGroup('   ')
    expect(result.success).toBe(false)
    expect(mockGroupCreate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  test('surfaces the unique-name violation as a friendly error', async () => {
    const { Prisma } = await import('@prisma/client')
    mockGroupFindFirst.mockResolvedValueOnce(null)
    mockGroupCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    const result = await createEmployeeGroup('Lager')
    expect(result.success).toBe(false)
    expect(result.error).toBe('En grupp med det namnet finns redan.')
  })
})

describe('renameEmployeeGroup', () => {
  test('updateMany filters by both id and workspace_id', async () => {
    mockGroupUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await renameEmployeeGroup('grp-1', 'Huvudkontor')

    expect(lastRequiredPermission).toBe('employees:manage')
    const arg = mockGroupUpdateMany.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
      data: { name: string }
    }
    expect(arg.where).toEqual({ id: 'grp-1', workspace_id: WORKSPACE_ID })
    expect(arg.data).toEqual({ name: 'Huvudkontor' })
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('returns error (no revalidate) when the group is outside the workspace', async () => {
    mockGroupUpdateMany.mockResolvedValueOnce({ count: 0 })

    const result = await renameEmployeeGroup('grp-other-ws', 'X')
    expect(result.success).toBe(false)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('reorderEmployeeGroups', () => {
  /** Helper to read the updateMany calls in a typed shape. */
  const updateCalls = () =>
    mockGroupUpdateMany.mock.calls.map(
      (c) =>
        c[0] as {
          where: { id: string; workspace_id: string }
          data: { position: number }
        }
    )

  test('renumbers positions 0..n (Int renumbering, no fractions), workspace-scoped', async () => {
    mockGroupFindMany.mockResolvedValueOnce([
      { id: 'grp-a' },
      { id: 'grp-b' },
      { id: 'grp-c' },
    ])
    mockGroupUpdateMany.mockResolvedValue({ count: 1 })

    const result = await reorderEmployeeGroups(['grp-b', 'grp-a', 'grp-c'])

    expect(lastRequiredPermission).toBe('employees:manage')
    // The workspace's groups are fetched first (DATA-001 intersection).
    const findArg = mockGroupFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
    }
    expect(findArg.where.workspace_id).toBe(WORKSPACE_ID)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockGroupUpdateMany).toHaveBeenCalledTimes(3)

    const calls = updateCalls()
    expect(calls[0]?.where).toEqual({
      id: 'grp-b',
      workspace_id: WORKSPACE_ID,
    })
    expect(calls.map((c) => c.data.position)).toEqual([0, 1, 2])
    expect(calls.every((c) => c.where.workspace_id === WORKSPACE_ID)).toBe(true)
    expect(calls.every((c) => Number.isInteger(c.data.position))).toBe(true)
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('ignores foreign/unknown ids — positions stay contiguous (QA DATA-001)', async () => {
    mockGroupFindMany.mockResolvedValueOnce([{ id: 'grp-a' }, { id: 'grp-b' }])
    mockGroupUpdateMany.mockResolvedValue({ count: 1 })

    const result = await reorderEmployeeGroups([
      'grp-b',
      'grp-foreign-ws', // not in this workspace — must not consume an index
      'grp-a',
    ])

    const calls = updateCalls()
    expect(calls.map((c) => c.where.id)).toEqual(['grp-b', 'grp-a'])
    expect(calls.map((c) => c.data.position)).toEqual([0, 1]) // no gap at 1
    expect(result.success).toBe(true)
  })

  test('appends omitted workspace groups after the requested ones, in stable order (QA DATA-001)', async () => {
    // Current stable order (position asc, created_at asc): a, b, c, d.
    mockGroupFindMany.mockResolvedValueOnce([
      { id: 'grp-a' },
      { id: 'grp-b' },
      { id: 'grp-c' },
      { id: 'grp-d' },
    ])
    mockGroupUpdateMany.mockResolvedValue({ count: 1 })

    // Partial list: only c and a submitted; b and d omitted.
    const result = await reorderEmployeeGroups(['grp-c', 'grp-a'])

    const calls = updateCalls()
    // Requested first (caller order), then omitted in stable current order —
    // positions gap-free and unique.
    expect(calls.map((c) => c.where.id)).toEqual([
      'grp-c',
      'grp-a',
      'grp-b',
      'grp-d',
    ])
    expect(calls.map((c) => c.data.position)).toEqual([0, 1, 2, 3])
    expect(result.success).toBe(true)
  })

  test('dedupes repeated ids in the incoming list', async () => {
    mockGroupFindMany.mockResolvedValueOnce([{ id: 'grp-a' }, { id: 'grp-b' }])
    mockGroupUpdateMany.mockResolvedValue({ count: 1 })

    await reorderEmployeeGroups(['grp-b', 'grp-b', 'grp-a'])

    const calls = updateCalls()
    expect(calls.map((c) => c.where.id)).toEqual(['grp-b', 'grp-a'])
    expect(calls.map((c) => c.data.position)).toEqual([0, 1])
  })
})

describe('deleteEmployeeGroup', () => {
  test('deleteMany filters by id + workspace_id and never touches employees (SetNull)', async () => {
    mockGroupDeleteMany.mockResolvedValueOnce({ count: 1 })

    const result = await deleteEmployeeGroup('grp-1')

    expect(lastRequiredPermission).toBe('employees:manage')
    const arg = mockGroupDeleteMany.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(arg.where).toEqual({ id: 'grp-1', workspace_id: WORKSPACE_ID })
    // The FK is onDelete: SetNull — the action must not update employees itself.
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('returns error when the group is outside the workspace', async () => {
    mockGroupDeleteMany.mockResolvedValueOnce({ count: 0 })

    const result = await deleteEmployeeGroup('grp-other-ws')
    expect(result.success).toBe(false)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('moveEmployeeToGroup', () => {
  test('validates that the target group belongs to the workspace', async () => {
    mockGroupFindFirst.mockResolvedValueOnce(null) // group not in workspace

    const result = await moveEmployeeToGroup('emp-1', 'grp-foreign')

    const arg = mockGroupFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(arg.where).toEqual({
      id: 'grp-foreign',
      workspace_id: WORKSPACE_ID,
    })
    expect(result.success).toBe(false)
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  test('moves the employee with workspace-scoped updateMany', async () => {
    mockGroupFindFirst.mockResolvedValueOnce({ id: 'grp-1' })
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await moveEmployeeToGroup('emp-1', 'grp-1')

    expect(lastRequiredPermission).toBe('employees:manage')
    const arg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
      data: { group_id: string | null }
    }
    expect(arg.where).toEqual({ id: 'emp-1', workspace_id: WORKSPACE_ID })
    expect(arg.data).toEqual({ group_id: 'grp-1' })
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('ungroups with groupId null (no group lookup needed)', async () => {
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await moveEmployeeToGroup('emp-1', null)

    expect(mockGroupFindFirst).not.toHaveBeenCalled()
    const arg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: { group_id: string | null }
    }
    expect(arg.data).toEqual({ group_id: null })
    expect(result.success).toBe(true)
  })

  test('returns error when the employee is outside the workspace', async () => {
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 0 })

    const result = await moveEmployeeToGroup('emp-other-ws', null)
    expect(result.success).toBe(false)
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Story 7.3: createEmployee / updateEmployee / getCollectiveAgreements
// ===========================================================================

const PLAINTEXT_PNR = '640823-3234'

/** Full DB-shaped employee record (what getEmployeeRow's findFirst returns). */
function makeDbEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-new',
    workspace_id: WORKSPACE_ID,
    created_by: 'user-1',
    employee_id_ref: null,
    personnummer: `enc:${PLAINTEXT_PNR}`,
    first_name: 'Anna',
    last_name: 'Svensson',
    email: null,
    phone1: null,
    phone2: null,
    address1: null,
    address2: null,
    post_code: null,
    city: null,
    country: 'SE',
    job_title: null,
    employment_date: null,
    employed_to: null,
    employment_form: null,
    personel_type: null,
    inactive: false,
    full_time_equivalent: null,
    average_weekly_hours: null,
    schedule_id: null,
    salary_form: null,
    monthly_salary: null,
    hourly_pay: null,
    vacation_days_paid: null,
    collective_agreement_id: null,
    group_id: null,
    manager_id: null,
    fortnox_employee_id: null,
    fortnox_synced_at: null,
    fortnox_sync_status: 'NOT_LINKED',
    fortnox_raw: { PersonalIdentityNumber: 'RAW-FORTNOX-PII' },
    created_at: new Date('2026-07-01T00:00:00Z'),
    updated_at: new Date('2026-07-01T00:00:00Z'),
    group: null,
    collective_agreement: null,
    ...overrides,
  }
}

const MINIMAL_INPUT = { first_name: 'Anna', last_name: 'Svensson' }

describe('createEmployee (Story 7.3)', () => {
  test('encrypts personnummer before store — plaintext never persisted', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(makeDbEmployee())

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      personnummer: PLAINTEXT_PNR,
    })

    expect(lastRequiredPermission).toBe('employees:manage')
    const createArg = mockEmployeeCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    // The stored value went through the encryptPersonnummer path.
    expect(createArg.data.personnummer).toBe(`enc:${PLAINTEXT_PNR}`)
    expect(createArg.data.personnummer).not.toBe(PLAINTEXT_PNR)
    // Plaintext appears nowhere in the persisted payload.
    expect(JSON.stringify(createArg.data)).not.toContain(`"${PLAINTEXT_PNR}"`)
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('sets created_by and workspace_id from ctx', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(makeDbEmployee())

    await createEmployee(MINIMAL_INPUT)

    const createArg = mockEmployeeCreate.mock.calls[0]?.[0] as {
      data: { workspace_id: string; created_by: string }
    }
    expect(createArg.data.workspace_id).toBe(WORKSPACE_ID)
    expect(createArg.data.created_by).toBe('user-1')
  })

  test('returns the sanitized serialized row — no fortnox_raw, no ciphertext', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(makeDbEmployee())

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      personnummer: PLAINTEXT_PNR,
    })

    expect(result.success).toBe(true)
    const serialized = JSON.stringify(result.data)
    expect(serialized).not.toContain('fortnox_raw')
    expect(serialized).not.toContain('RAW-FORTNOX-PII')
    expect(serialized).not.toContain('enc:')
    // Manage role gets the decrypted value back (7.1 read contract).
    expect(result.data?.personnummer).toBe(PLAINTEXT_PNR)
    expect(result.data?.personnummer_masked).toBe(false)
  })

  test('rejects an invalid personnummer with the Swedish message, no DB touch', async () => {
    const result = await createEmployee({
      ...MINIMAL_INPUT,
      personnummer: '640823-3235', // Luhn failure
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ogiltigt personnummer')
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  test('name-only input passes (lenient-required design)', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(
      makeDbEmployee({ personnummer: null })
    )

    const result = await createEmployee(MINIMAL_INPUT)

    expect(result.success).toBe(true)
    const createArg = mockEmployeeCreate.mock.calls[0]?.[0] as {
      data: { personnummer: string | null }
    }
    expect(createArg.data.personnummer).toBeNull()
  })

  test('TEST-001: fail-closed encryption — friendly error, no write, nothing logged', async () => {
    mockEncryptPersonnummer.mockImplementation(() => {
      throw new Error('ENCRYPTION_KEY missing')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await createEmployee({
        ...MINIMAL_INPUT,
        personnummer: PLAINTEXT_PNR,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(
        'Personnummer kunde inte sparas säkert just nu. Försök igen eller kontakta support.'
      )
      // No crash, no partial write, no revalidation.
      expect(mockEmployeeCreate).not.toHaveBeenCalled()
      expect(mockRevalidatePath).not.toHaveBeenCalled()
      // Fail closed AND quiet — nothing is logged on this branch.
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  test('rejects missing first name without touching the DB', async () => {
    const result = await createEmployee({
      first_name: '   ',
      last_name: 'Svensson',
    })
    expect(result.success).toBe(false)
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })

  test('rejects full_time_equivalent outside 0–1', async () => {
    const result = await createEmployee({
      ...MINIMAL_INPUT,
      full_time_equivalent: 1.5,
    })
    expect(result.success).toBe(false)
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })

  test('validates that the manager belongs to the workspace', async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce(null) // manager lookup

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      manager_id: 'mgr-foreign',
    })

    const findArg = mockEmployeeFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(findArg.where).toEqual({
      id: 'mgr-foreign',
      workspace_id: WORKSPACE_ID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Chefen kunde inte hittas.')
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })

  test('validates that the kollektivavtal belongs to the workspace', async () => {
    mockAgreementFindFirst.mockResolvedValueOnce(null)

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      collective_agreement_id: 'ca-foreign',
    })

    const findArg = mockAgreementFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(findArg.where).toEqual({
      id: 'ca-foreign',
      workspace_id: WORKSPACE_ID,
    })
    expect(result.success).toBe(false)
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })

  test('validates that the group belongs to the workspace', async () => {
    mockGroupFindFirst.mockResolvedValueOnce(null)

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      group_id: 'grp-foreign',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Gruppen kunde inte hittas.')
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })
})

describe('updateEmployee (Story 7.3)', () => {
  test('refuses cross-workspace rows (ownership check before any write)', async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce(null) // existing check

    const result = await updateEmployee('emp-other-ws', MINIMAL_INPUT)

    expect(lastRequiredPermission).toBe('employees:manage')
    const findArg = mockEmployeeFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(findArg.where).toEqual({
      id: 'emp-other-ws',
      workspace_id: WORKSPACE_ID,
    })
    expect(result.success).toBe(false)
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  test('writes with a workspace-scoped updateMany and encrypts personnummer', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' }) // existing check
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' })) // row re-read
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      personnummer: PLAINTEXT_PNR,
    })

    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
      data: Record<string, unknown>
    }
    expect(updateArg.where).toEqual({
      id: 'emp-1',
      workspace_id: WORKSPACE_ID,
    })
    expect(updateArg.data.personnummer).toBe(`enc:${PLAINTEXT_PNR}`)
    expect(JSON.stringify(updateArg.data)).not.toContain(`"${PLAINTEXT_PNR}"`)
    expect(result.success).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/personalregister')
  })

  test('rejects self-management (manager_id === id)', async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-1' }) // existing

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      manager_id: 'emp-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('En anställd kan inte vara sin egen chef.')
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
  })

  test('validates that the manager belongs to the workspace', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' }) // existing check
      .mockResolvedValueOnce(null) // manager lookup

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      manager_id: 'mgr-foreign',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Chefen kunde inte hittas.')
    expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------
  // QA DATA-001: three-state personnummer contract on update.
  //  undefined (key absent) → column OMITTED from the write (keep stored),
  //  '' / null              → explicit clear → null,
  //  value                  → validate + encrypt + set (covered above).
  // -------------------------------------------------------------------

  test('DATA-001: input without a personnummer key leaves the column untouched (masked prefill keeps stored ciphertext)', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' }) // existing check
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' })) // row re-read
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    // MINIMAL_INPUT has no personnummer key — the untouched masked-prefill
    // path submits exactly this shape.
    const result = await updateEmployee('emp-1', MINIMAL_INPUT)

    expect(result.success).toBe(true)
    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    // The write payload must have NO personnummer key at all — not null,
    // not undefined-valued: the stored ciphertext survives the edit.
    expect('personnummer' in updateArg.data).toBe(false)
    expect(mockEncryptPersonnummer).not.toHaveBeenCalled()
  })

  test('DATA-001: transient-key scenario — routine edit while every row is masked never writes the personnummer column', async () => {
    // During an ENCRYPTION_KEY misconfiguration, decrypt fails and toView
    // degrades rows to the mask; the form prefills empty and (per the
    // three-state contract) submits WITHOUT the personnummer key. The
    // recoverable ciphertext must survive the save.
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' }))
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      email: 'ny.adress@example.se', // the routine edit
    })

    expect(result.success).toBe(true)
    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(updateArg.data.email).toBe('ny.adress@example.se')
    expect('personnummer' in updateArg.data).toBe(false)
  })

  test("DATA-001: explicit '' clears the stored personnummer to null", async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(
        makeDbEmployee({ id: 'emp-1', personnummer: null })
      )
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      personnummer: '',
    })

    expect(result.success).toBe(true)
    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect('personnummer' in updateArg.data).toBe(true)
    expect(updateArg.data.personnummer).toBeNull()
  })

  test('DATA-001: explicit null also clears the stored personnummer to null', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(
        makeDbEmployee({ id: 'emp-1', personnummer: null })
      )
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      personnummer: null,
    })

    expect(result.success).toBe(true)
    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(updateArg.data.personnummer).toBeNull()
  })

  test('TEST-001: fail-closed encryption — friendly error, no write, nothing logged', async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce({ id: 'emp-1' }) // existing
    mockEncryptPersonnummer.mockImplementation(() => {
      throw new Error('ENCRYPTION_KEY missing')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await updateEmployee('emp-1', {
        ...MINIMAL_INPUT,
        personnummer: PLAINTEXT_PNR,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(
        'Personnummer kunde inte sparas säkert just nu. Försök igen eller kontakta support.'
      )
      expect(mockEmployeeUpdateMany).not.toHaveBeenCalled()
      expect(mockRevalidatePath).not.toHaveBeenCalled()
      // Fail closed AND quiet — the plaintext-adjacent error is never logged.
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  test('returns the sanitized row (no fortnox_raw / ciphertext) after update', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' }))
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    const result = await updateEmployee('emp-1', MINIMAL_INPUT)

    expect(result.success).toBe(true)
    const serialized = JSON.stringify(result.data)
    expect(serialized).not.toContain('fortnox_raw')
    expect(serialized).not.toContain('RAW-FORTNOX-PII')
    expect(serialized).not.toContain('enc:')
  })
})

// ===========================================================================
// Story 7.10: salary encrypt-on-write (three-state) + no plaintext in return
// ===========================================================================
describe('employee salary (Story 7.10)', () => {
  test('createEmployee normalizes + encrypts the salary before store', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(makeDbEmployee())

    // Raw input with a Swedish comma + thousands space — normalized to
    // "45000.50" then encrypted.
    await createEmployee({
      ...MINIMAL_INPUT,
      salary_form: 'MAN',
      monthly_salary: '45 000,50',
    })

    const createArg = mockEmployeeCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(createArg.data.monthly_salary).toBe('enc:45000.50')
    expect(createArg.data.hourly_pay).toBeNull()
    // The RAW, un-normalized input never reaches the persisted payload (real
    // ciphertext hides the normalized value too — the `enc:` stand-in can't).
    expect(JSON.stringify(createArg.data)).not.toContain('"45 000,50"')
    expect(JSON.stringify(createArg.data)).not.toContain('45 000,50')
  })

  test('createEmployee returns the decrypted salary — no ciphertext leaks', async () => {
    mockEmployeeCreate.mockResolvedValueOnce({ id: 'emp-new' })
    mockEmployeeFindFirst.mockResolvedValueOnce(
      makeDbEmployee({ salary_form: 'MAN', monthly_salary: 'enc:45000.00' })
    )

    const result = await createEmployee({
      ...MINIMAL_INPUT,
      salary_form: 'MAN',
      monthly_salary: '45000',
    })

    expect(result.success).toBe(true)
    expect(result.data?.monthly_salary).toBe('45000.00')
    expect(result.data?.salary_masked).toBe(false)
    expect(JSON.stringify(result.data)).not.toContain('enc:')
  })

  test('createEmployee rejects an invalid salary with a friendly error, no DB touch', async () => {
    const result = await createEmployee({
      ...MINIMAL_INPUT,
      salary_form: 'MAN',
      monthly_salary: '-100',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Ange ett giltigt lönebelopp (0 eller mer).')
    expect(mockEmployeeCreate).not.toHaveBeenCalled()
  })

  test('three-state: input WITHOUT the salary keys leaves the columns untouched', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' }))
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    // MINIMAL_INPUT carries no salary keys → the masked-prefill keep path.
    await updateEmployee('emp-1', MINIMAL_INPUT)

    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect('monthly_salary' in updateArg.data).toBe(false)
    expect('hourly_pay' in updateArg.data).toBe(false)
  })

  test("three-state: explicit '' clears the stored salary to null", async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' }))
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    await updateEmployee('emp-1', { ...MINIMAL_INPUT, monthly_salary: '' })

    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect('monthly_salary' in updateArg.data).toBe(true)
    expect(updateArg.data.monthly_salary).toBeNull()
  })

  test('three-state: a value is normalized + encrypted + set', async () => {
    mockEmployeeFindFirst
      .mockResolvedValueOnce({ id: 'emp-1' })
      .mockResolvedValueOnce(makeDbEmployee({ id: 'emp-1' }))
    mockEmployeeUpdateMany.mockResolvedValueOnce({ count: 1 })

    await updateEmployee('emp-1', {
      ...MINIMAL_INPUT,
      salary_form: 'TIM',
      hourly_pay: '185,5',
    })

    const updateArg = mockEmployeeUpdateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(updateArg.data.hourly_pay).toBe('enc:185.50')
  })
})

describe('getCollectiveAgreements (Story 7.3)', () => {
  test('workspace-scoped list gated by employees:view', async () => {
    mockAgreementFindMany.mockResolvedValueOnce([
      {
        id: 'ca-1',
        name: 'Byggavtalet',
        personel_type: 'ARB',
        status: 'READY',
      },
    ])

    const result = await getCollectiveAgreements()

    expect(lastRequiredPermission).toBe('employees:view')
    const arg = mockAgreementFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
      select: Record<string, boolean>
    }
    expect(arg.where.workspace_id).toBe(WORKSPACE_ID)
    // Narrow select — the option shape only (no workspace_file/uploaded_by).
    expect(Object.keys(arg.select).sort()).toEqual([
      'id',
      'name',
      'personel_type',
      'status',
    ])
    expect(result.success).toBe(true)
    expect(result.data).toEqual([
      {
        id: 'ca-1',
        name: 'Byggavtalet',
        personel_type: 'ARB',
        status: 'READY',
      },
    ])
  })

  test('returns a friendly error on failure', async () => {
    mockAgreementFindMany.mockRejectedValueOnce(new Error('db down'))
    const result = await getCollectiveAgreements()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte hämta kollektivavtal.')
  })
})

describe('getEmployeesForChatContext (Story 7.7)', () => {
  test('workspace-scoped ALLOWLIST select gated by employees:view, serialized at the boundary', async () => {
    mockEmployeeFindMany.mockResolvedValueOnce([
      {
        id: 'emp-1',
        first_name: 'Anna',
        last_name: 'Svensson',
        personel_type: 'TJM',
        employment_form: 'TV',
        employment_date: new Date('2020-03-01T00:00:00Z'),
        full_time_equivalent: { toNumber: () => 0.75 },
        inactive: false,
        collective_agreement: { id: 'ca-1', name: 'Teknikavtalet' },
      },
      {
        id: 'emp-2',
        first_name: 'Bert',
        last_name: 'Karlsson',
        personel_type: null,
        employment_form: null,
        employment_date: null,
        full_time_equivalent: null,
        inactive: true,
        collective_agreement: null,
      },
    ])

    const result = await getEmployeesForChatContext()

    expect(lastRequiredPermission).toBe('employees:view')
    const arg = mockEmployeeFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
      select: Record<string, unknown>
    }
    expect(arg.where.workspace_id).toBe(WORKSPACE_ID)
    // PII allowlist: no personnummer/email/phone/address/fortnox_raw.
    expect(Object.keys(arg.select).sort()).toEqual(
      [
        'id',
        'first_name',
        'last_name',
        'personel_type',
        'employment_form',
        'employment_date',
        'full_time_equivalent',
        'inactive',
        'collective_agreement',
      ].sort()
    )
    expect(arg.select.personnummer).toBeUndefined()
    expect(arg.select.email).toBeUndefined()
    expect(arg.select.phone1).toBeUndefined()
    expect(arg.select.address1).toBeUndefined()
    expect(arg.select.fortnox_raw).toBeUndefined()

    expect(result.success).toBe(true)
    // Decimal -> number, Date -> YYYY-MM-DD (client-boundary serialization).
    expect(result.data?.[0]).toMatchObject({
      id: 'emp-1',
      employment_date: '2020-03-01',
      full_time_equivalent: 0.75,
      collective_agreement: { id: 'ca-1', name: 'Teknikavtalet' },
    })
    expect(result.data?.[1]).toMatchObject({
      id: 'emp-2',
      employment_date: null,
      full_time_equivalent: null,
      collective_agreement: null,
    })
    // Absence in the payload too, not just the select.
    expect(JSON.stringify(result.data)).not.toMatch(/personnummer|@|fortnox/i)
  })

  test('returns a friendly error on failure', async () => {
    mockEmployeeFindMany.mockRejectedValueOnce(new Error('db down'))
    const result = await getEmployeesForChatContext()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte hämta anställda.')
  })
})

import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { WorkspaceContext } from '@/lib/auth/workspace-context'
import type { Permission } from '@/lib/auth/permissions'

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

// Keep withWorkspace a thin passthrough so importing the repository doesn't pull
// in next/headers, session, redis, etc. The ctx-based functions are tested
// directly with a fabricated context.
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

import {
  listEmployees,
  listEmployeeRows,
  getEmployee,
} from '@/lib/employees/employee-repository'
import {
  encryptPersonnummer,
  PERSONNUMMER_MASK,
} from '@/lib/employees/personnummer'
import { encryptSalary, SALARY_MASK } from '@/lib/employees/salary'

const WORKSPACE_ID = 'ws-0001'
const OTHER_WORKSPACE_ID = 'ws-9999'
const PERSONNUMMER = '19900101-1234'

// Valid 32-byte base64 key so the real crypto path runs in the manage test.
const TEST_KEY = Buffer.alloc(32, 3).toString('base64')

function makeCtx(permissions: Permission[]): WorkspaceContext {
  return {
    userId: 'user-1',
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme',
    workspaceSlug: 'acme',
    workspaceStatus: 'ACTIVE',
    role: 'HR_MANAGER',
    hasPermission: (perm: Permission) => permissions.includes(perm),
  } as WorkspaceContext
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-1',
    workspace_id: WORKSPACE_ID,
    created_by: 'user-1',
    first_name: 'Anna',
    last_name: 'Andersson',
    personnummer: null,
    inactive: false,
    fortnox_sync_status: 'NOT_LINKED',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
})

describe('employee-repository — workspace isolation', () => {
  test('listEmployees always filters by workspace_id from context', async () => {
    mockFindMany.mockResolvedValueOnce([])
    await listEmployees(makeCtx(['employees:view']))

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const arg = mockFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
    }
    expect(arg.where.workspace_id).toBe(WORKSPACE_ID)
  })

  test('getEmployee filters by both id and workspace_id', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    await getEmployee(makeCtx(['employees:view']), 'emp-1')

    expect(mockFindFirst).toHaveBeenCalledTimes(1)
    const arg = mockFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; workspace_id: string }
    }
    expect(arg.where).toEqual({ id: 'emp-1', workspace_id: WORKSPACE_ID })
  })

  test('getEmployee returns null for a row outside the workspace (not found)', async () => {
    // Simulate the DB returning nothing because the row is in another workspace.
    mockFindFirst.mockResolvedValueOnce(null)
    const result = await getEmployee(
      makeCtx(['employees:manage']),
      'emp-in-other-ws'
    )
    expect(result).toBeNull()
    const arg = mockFindFirst.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
    }
    expect(arg.where.workspace_id).not.toBe(OTHER_WORKSPACE_ID)
  })
})

describe('employee-repository — personnummer role gating', () => {
  test('masks personnummer for employees:view-only role', async () => {
    const cipher = encryptPersonnummer(PERSONNUMMER)
    mockFindMany.mockResolvedValueOnce([makeRow({ personnummer: cipher })])

    const [emp] = await listEmployees(makeCtx(['employees:view']))
    expect(emp?.personnummer).toBe(PERSONNUMMER_MASK)
    expect(emp?.personnummer_masked).toBe(true)
    // The plaintext must never leak to a view-only caller.
    expect(emp?.personnummer).not.toBe(PERSONNUMMER)
  })

  test('decrypts personnummer for employees:manage role', async () => {
    const cipher = encryptPersonnummer(PERSONNUMMER)
    mockFindFirst.mockResolvedValueOnce(makeRow({ personnummer: cipher }))

    const emp = await getEmployee(
      makeCtx(['employees:view', 'employees:manage']),
      'emp-1'
    )
    expect(emp?.personnummer).toBe(PERSONNUMMER)
    expect(emp?.personnummer_masked).toBe(false)
  })

  test('null personnummer stays null (no mask, not flagged)', async () => {
    mockFindMany.mockResolvedValueOnce([makeRow({ personnummer: null })])

    const [emp] = await listEmployees(makeCtx(['employees:manage']))
    expect(emp?.personnummer).toBeNull()
    expect(emp?.personnummer_masked).toBe(false)
  })

  // QA fix (PII-FORTNOX-RAW): fortnox_raw holds the plaintext PersonalIdentityNumber
  // and must never leave this layer, even for a manage role.
  test('never returns fortnox_raw in the view (plaintext PII stays server-side)', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({
        personnummer: encryptPersonnummer(PERSONNUMMER),
        fortnox_raw: {
          PersonalIdentityNumber: PERSONNUMMER,
          FirstName: 'Anna',
        },
      }),
    ])

    const [emp] = await listEmployees(makeCtx(['employees:manage']))
    expect(emp).toBeDefined()
    expect('fortnox_raw' in (emp as object)).toBe(false)
    expect(JSON.stringify(emp)).not.toContain('PersonalIdentityNumber')
  })

  // QA fix (DECRYPT-FAILS-LIST): a single unreadable ciphertext must degrade to
  // the mask, not throw out of listEmployees and 500 the whole register.
  test('degrades to mask (does not throw) when a row has a corrupt ciphertext', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({ personnummer: 'not-a-valid-ciphertext' }),
    ])

    const result = await listEmployees(makeCtx(['employees:manage']))
    expect(result[0]?.personnummer).toBe(PERSONNUMMER_MASK)
    expect(result[0]?.personnummer_masked).toBe(true)
  })
})

// Story 7.10: salary is manage-only, encrypted at rest — decrypt for manage,
// mask/strip for view, degrade a corrupt ciphertext, NEVER emit ciphertext.
describe('employee-repository — salary role gating (Story 7.10)', () => {
  const MONTHLY = '45000.00'
  const HOURLY = '185.50'

  test('decrypts salary for employees:manage', async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeRow({
        monthly_salary: encryptSalary(MONTHLY),
        hourly_pay: encryptSalary(HOURLY),
      })
    )
    const emp = await getEmployee(
      makeCtx(['employees:view', 'employees:manage']),
      'emp-1'
    )
    expect(emp?.monthly_salary).toBe(MONTHLY)
    expect(emp?.hourly_pay).toBe(HOURLY)
    expect(emp?.salary_masked).toBe(false)
  })

  test('masks salary for a view-only role and never emits the ciphertext', async () => {
    const monthlyCipher = encryptSalary(MONTHLY)
    mockFindMany.mockResolvedValueOnce([
      makeRow({ monthly_salary: monthlyCipher, hourly_pay: null }),
    ])
    const [emp] = await listEmployees(makeCtx(['employees:view']))
    expect(emp?.monthly_salary).toBe(SALARY_MASK)
    expect(emp?.salary_masked).toBe(true)
    // Neither the plaintext amount nor the ciphertext leaks.
    expect(emp?.monthly_salary).not.toBe(MONTHLY)
    expect(JSON.stringify(emp)).not.toContain(monthlyCipher)
    expect(JSON.stringify(emp)).not.toContain(MONTHLY)
  })

  test('null salary stays null (no mask, not flagged)', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({ monthly_salary: null, hourly_pay: null }),
    ])
    const [emp] = await listEmployees(makeCtx(['employees:manage']))
    expect(emp?.monthly_salary).toBeNull()
    expect(emp?.hourly_pay).toBeNull()
    expect(emp?.salary_masked).toBe(false)
  })

  test('degrades a corrupt ciphertext to the mask (does not throw)', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({ monthly_salary: 'not-a-valid-ciphertext', hourly_pay: null }),
    ])
    const result = await listEmployees(makeCtx(['employees:manage']))
    expect(result[0]?.monthly_salary).toBe(SALARY_MASK)
    expect(result[0]?.salary_masked).toBe(true)
  })
})

// Story 7.2: listEmployeeRows — same sanitization contract + relation names.
describe('employee-repository — listEmployeeRows (Story 7.2)', () => {
  test('always filters by workspace_id and includes group + collective_agreement names', async () => {
    mockFindMany.mockResolvedValueOnce([])
    await listEmployeeRows(makeCtx(['employees:view']))

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const arg = mockFindMany.mock.calls[0]?.[0] as {
      where: { workspace_id: string }
      include: Record<string, unknown>
    }
    expect(arg.where.workspace_id).toBe(WORKSPACE_ID)
    expect(arg.include).toEqual({
      group: { select: { id: true, name: true } },
      collective_agreement: { select: { id: true, name: true } },
    })
  })

  test('returns relation objects on the row (and null when unset)', async () => {
    mockFindMany.mockResolvedValueOnce([
      makeRow({
        group: { id: 'grp-1', name: 'Lager' },
        collective_agreement: { id: 'ca-1', name: 'Byggnads 2024' },
      }),
      makeRow({ id: 'emp-2', group: null, collective_agreement: null }),
    ])

    const rows = await listEmployeeRows(makeCtx(['employees:view']))
    expect(rows[0]?.group).toEqual({ id: 'grp-1', name: 'Lager' })
    expect(rows[0]?.collective_agreement).toEqual({
      id: 'ca-1',
      name: 'Byggnads 2024',
    })
    expect(rows[1]?.group).toBeNull()
    expect(rows[1]?.collective_agreement).toBeNull()
  })

  test('still masks personnummer for view-only role', async () => {
    const cipher = encryptPersonnummer(PERSONNUMMER)
    mockFindMany.mockResolvedValueOnce([
      makeRow({
        personnummer: cipher,
        group: null,
        collective_agreement: null,
      }),
    ])

    const [row] = await listEmployeeRows(makeCtx(['employees:view']))
    expect(row?.personnummer).toBe(PERSONNUMMER_MASK)
    expect(row?.personnummer_masked).toBe(true)
  })

  test('still decrypts personnummer for manage role', async () => {
    const cipher = encryptPersonnummer(PERSONNUMMER)
    mockFindMany.mockResolvedValueOnce([
      mkRowWithRelations({ personnummer: cipher }),
    ])

    const [row] = await listEmployeeRows(
      makeCtx(['employees:view', 'employees:manage'])
    )
    expect(row?.personnummer).toBe(PERSONNUMMER)
    expect(row?.personnummer_masked).toBe(false)
  })

  test('still strips fortnox_raw from rows', async () => {
    mockFindMany.mockResolvedValueOnce([
      mkRowWithRelations({
        personnummer: encryptPersonnummer(PERSONNUMMER),
        fortnox_raw: { PersonalIdentityNumber: PERSONNUMMER },
      }),
    ])

    const [row] = await listEmployeeRows(makeCtx(['employees:manage']))
    expect(row).toBeDefined()
    expect('fortnox_raw' in (row as object)).toBe(false)
    expect(JSON.stringify(row)).not.toContain('PersonalIdentityNumber')
  })
})

function mkRowWithRelations(overrides: Record<string, unknown> = {}) {
  return makeRow({ group: null, collective_agreement: null, ...overrides })
}

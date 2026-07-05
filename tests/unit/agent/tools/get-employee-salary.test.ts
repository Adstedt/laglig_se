/**
 * Unit tests for the get_employee_salary tool (Story 7.10, Task 7 + 9).
 * Mocks prisma — asserts:
 *  - employeeId precedence (explicit param > biasEmployeeId closure) + the
 *    no-id error path;
 *  - workspace isolation (compound WHERE) + the PII allowlist select;
 *  - server-side salary DECRYPTION in the output;
 *  - the output is PII-free (never personnummer/email/phone/address);
 *  - a corrupt ciphertext degrades to null (never throws).
 *
 * Role-gated REGISTRATION (present ONLY with employees:manage) is covered in
 * tests/unit/agent/tools/registry-role-filter.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encryptSalary } from '@/lib/employees/salary'

const { mockFindFirst } = vi.hoisted(() => ({ mockFindFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { employee: { findFirst: mockFindFirst } },
}))

import { createGetEmployeeSalaryTool } from '@/lib/agent/tools/get-employee-salary'

type ToolWithExecute = {
  execute: (_args: { employeeId?: string }, _opts?: unknown) => Promise<unknown>
}

const TEST_KEY = Buffer.alloc(32, 9).toString('base64')

function makeTool(workspaceId = 'ws-1', bias?: string) {
  return createGetEmployeeSalaryTool(
    workspaceId,
    bias
  ) as unknown as ToolWithExecute
}

/** DB row carrying PII fields the select must exclude — pins the allowlist. */
function dbRow(over: Record<string, unknown> = {}) {
  return {
    first_name: 'Anna',
    last_name: 'Svensson',
    monthly_salary: encryptSalary('45000.00'),
    hourly_pay: null,
    salary_form: 'MAN',
    personel_type: 'TJM',
    collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    ...over,
  }
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
  vi.clearAllMocks()
  mockFindFirst.mockResolvedValue(dbRow())
})

describe('get_employee_salary — id precedence + query shape', () => {
  it('uses the explicit employeeId param over the closure bias', async () => {
    const tool = makeTool('ws-77', 'bias-emp')
    await tool.execute({ employeeId: 'explicit-emp' })

    const args = mockFindFirst.mock.calls[0]![0] as {
      where: { id: string; workspace_id: string }
    }
    expect(args.where).toEqual({
      id: 'explicit-emp',
      workspace_id: 'ws-77',
    })
  })

  it('falls back to the biasEmployeeId closure when no param is given', async () => {
    const tool = makeTool('ws-1', 'bias-emp')
    await tool.execute({})

    const args = mockFindFirst.mock.calls[0]![0] as {
      where: { id: string }
    }
    expect(args.where.id).toBe('bias-emp')
  })

  it('with neither param nor bias → Swedish error, no DB call', async () => {
    const tool = makeTool('ws-1')
    const out = (await tool.execute({})) as { error: boolean; message: string }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/ingen anställd/i)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('the select is the PII allowlist — no personnummer/email/phone/address', async () => {
    const tool = makeTool('ws-1', 'emp')
    await tool.execute({})
    const args = mockFindFirst.mock.calls[0]![0] as {
      select: Record<string, unknown>
    }
    expect(args.select.personnummer).toBeUndefined()
    expect(args.select.email).toBeUndefined()
    expect(args.select.phone1).toBeUndefined()
    expect(args.select.address1).toBeUndefined()
    expect(args.select.fortnox_raw).toBeUndefined()
  })
})

describe('get_employee_salary — output', () => {
  it('decrypts the salary server-side and returns the compliance shape', async () => {
    const tool = makeTool('ws-1', 'emp')
    const out = (await tool.execute({})) as {
      data: Record<string, unknown>
    }
    expect(out.data).toEqual({
      name: 'Anna Svensson',
      monthly_salary: '45000.00',
      hourly_pay: null,
      salary_form: 'MAN',
      personel_type: 'TJM',
      collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    })
  })

  it('NEVER emits personnummer/email/phone/address (allowlist by construction)', async () => {
    mockFindFirst.mockResolvedValue(
      dbRow({
        // pollute with PII that must never surface
        personnummer: '19850101-1234',
        email: 'anna@example.com',
        phone1: '070-123 45 67',
        address1: 'Storgatan 1',
      })
    )
    const tool = makeTool('ws-1', 'emp')
    const json = JSON.stringify(await tool.execute({}))
    expect(json).not.toContain('19850101')
    expect(json).not.toMatch(/personnummer/i)
    expect(json).not.toContain('@')
    expect(json).not.toContain('070-123')
    expect(json).not.toContain('Storgatan')
  })

  it('returns the timlön amount when hourly_pay is set', async () => {
    mockFindFirst.mockResolvedValue(
      dbRow({
        monthly_salary: null,
        hourly_pay: encryptSalary('185.50'),
        salary_form: 'TIM',
      })
    )
    const tool = makeTool('ws-1', 'emp')
    const out = (await tool.execute({})) as { data: Record<string, unknown> }
    expect(out.data.hourly_pay).toBe('185.50')
    expect(out.data.monthly_salary).toBeNull()
  })

  it('degrades a corrupt salary ciphertext to null (does not throw)', async () => {
    mockFindFirst.mockResolvedValue(
      dbRow({ monthly_salary: 'not-a-valid-ciphertext' })
    )
    const tool = makeTool('ws-1', 'emp')
    const out = (await tool.execute({})) as { data: Record<string, unknown> }
    expect(out.data.monthly_salary).toBeNull()
  })

  it('unknown/foreign employee → Swedish not-found error', async () => {
    mockFindFirst.mockResolvedValue(null)
    const tool = makeTool('ws-1', 'emp')
    const out = (await tool.execute({ employeeId: 'nope' })) as {
      error: boolean
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/kunde inte hittas/i)
  })
})

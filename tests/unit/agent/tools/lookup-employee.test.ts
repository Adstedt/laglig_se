/**
 * Unit tests for the lookup_employee tool (Story 7.7, Task 2b + 7).
 * Mocks prisma — asserts:
 *  - workspace isolation + tokenized case-insensitive name matching + 5-cap;
 *  - the ALLOWLIST select (no PII fields ever selected);
 *  - PII ABSENCE in the tool OUTPUT even if the DB layer returned extra
 *    fields (allowlist-by-construction mapping);
 *  - Swedish label/format mapping + empty-result path.
 *
 * Role-gated REGISTRATION (tool absent without employees:view) is covered in
 * tests/unit/agent/tools/registry-role-filter.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { employee: { findMany: mockFindMany } },
}))

import { createLookupEmployeeTool } from '@/lib/agent/tools/lookup-employee'

type ToolWithExecute = {
  execute: (_args: { name: string }, _opts?: unknown) => Promise<unknown>
}

function makeTool(workspaceId = 'ws-1') {
  return createLookupEmployeeTool(workspaceId) as unknown as ToolWithExecute
}

/** A DB row that (maliciously) carries PII fields the select should exclude —
 *  proves the output mapping is an allowlist, not a pass-through. */
function dbRow(over: Record<string, unknown> = {}) {
  return {
    first_name: 'Anna',
    last_name: 'Svensson',
    employment_form: 'TV',
    employment_date: new Date('2020-03-01T00:00:00Z'),
    personel_type: 'TJM',
    full_time_equivalent: { toNumber: () => 0.75 },
    inactive: false,
    collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    // PII that must NEVER surface in output (not selected in prod; injected
    // here to pin the allowlist mapping):
    personnummer: '19850101-1234',
    email: 'anna.svensson@example.com',
    phone1: '070-123 45 67',
    address1: 'Storgatan 1',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindMany.mockResolvedValue([dbRow()])
})

describe('lookup_employee — query shape', () => {
  it('filters on the closure workspace id + caps at 5 matches', async () => {
    const tool = makeTool('ws-77')
    await tool.execute({ name: 'Anna' })

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const args = mockFindMany.mock.calls[0]![0] as {
      where: { workspace_id: string }
      take: number
    }
    expect(args.where.workspace_id).toBe('ws-77')
    expect(args.take).toBe(5)
  })

  it('single token matches förnamn OR efternamn, case-insensitive', async () => {
    const tool = makeTool()
    await tool.execute({ name: 'anna' })

    const args = mockFindMany.mock.calls[0]![0] as {
      where: { AND: Array<{ OR: unknown[] }> }
    }
    expect(args.where.AND).toHaveLength(1)
    expect(args.where.AND[0]).toEqual({
      OR: [
        { first_name: { contains: 'anna', mode: 'insensitive' } },
        { last_name: { contains: 'anna', mode: 'insensitive' } },
      ],
    })
  })

  it('"Anna Svensson" → every token must match some name field (AND of ORs)', async () => {
    const tool = makeTool()
    await tool.execute({ name: 'Anna Svensson' })

    const args = mockFindMany.mock.calls[0]![0] as {
      where: { AND: Array<{ OR: unknown[] }> }
    }
    expect(args.where.AND).toHaveLength(2)
  })

  it('the select is the ALLOWLIST — no personnummer/email/phone/address/fortnox_raw', async () => {
    const tool = makeTool()
    await tool.execute({ name: 'Anna' })

    const args = mockFindMany.mock.calls[0]![0] as {
      select: Record<string, unknown>
    }
    expect(Object.keys(args.select).sort()).toEqual(
      [
        'first_name',
        'last_name',
        'employment_form',
        'employment_date',
        'personel_type',
        'full_time_equivalent',
        'inactive',
        'collective_agreement',
      ].sort()
    )
    expect(args.select.personnummer).toBeUndefined()
    expect(args.select.email).toBeUndefined()
    expect(args.select.phone1).toBeUndefined()
    expect(args.select.address1).toBeUndefined()
    expect(args.select.fortnox_raw).toBeUndefined()
  })
})

describe('lookup_employee — output (PII absence by construction)', () => {
  it('maps to the allowlist shape with Swedish labels', async () => {
    const tool = makeTool()
    const out = (await tool.execute({ name: 'Anna' })) as {
      data: Array<Record<string, unknown>>
    }

    expect(out.data).toHaveLength(1)
    expect(out.data[0]).toEqual({
      name: 'Anna Svensson',
      employmentForm: 'Tillsvidareanställning',
      employmentDate: '2020-03-01',
      personelType: 'Tjänsteman',
      fullTimeEquivalent: '75 %',
      status: 'Aktiv',
      collectiveAgreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    })
  })

  it('NEVER emits personnummer/email/phone/address — even when the row carries them', async () => {
    const tool = makeTool()
    const out = await tool.execute({ name: 'Anna' })
    const json = JSON.stringify(out)

    expect(json).not.toContain('19850101')
    expect(json).not.toContain('19850101-1234')
    expect(json).not.toMatch(/personnummer/i)
    expect(json).not.toContain('anna.svensson@example.com')
    expect(json).not.toContain('@')
    expect(json).not.toContain('070-123')
    expect(json).not.toContain('Storgatan')
  })

  it('missing optional fields render as "Ej ifylld"; inactive → "Inaktiv"; no agreement → null', async () => {
    mockFindMany.mockResolvedValue([
      dbRow({
        employment_form: null,
        employment_date: null,
        personel_type: null,
        full_time_equivalent: null,
        inactive: true,
        collective_agreement: null,
      }),
    ])
    const tool = makeTool()
    const out = (await tool.execute({ name: 'Anna' })) as {
      data: Array<Record<string, unknown>>
    }

    expect(out.data[0]).toMatchObject({
      employmentForm: 'Ej ifylld',
      employmentDate: 'Ej ifylld',
      personelType: 'Ej ifylld',
      fullTimeEquivalent: 'Ej ifylld',
      status: 'Inaktiv',
      collectiveAgreement: null,
    })
  })

  it('returns up to 5 disambiguation candidates', async () => {
    mockFindMany.mockResolvedValue([
      dbRow({ first_name: 'Anna', last_name: 'Andersson' }),
      dbRow({ first_name: 'Anna', last_name: 'Berg' }),
      dbRow({ first_name: 'Anna', last_name: 'Ceder' }),
      dbRow({ first_name: 'Anna', last_name: 'Dahl' }),
      dbRow({ first_name: 'Anna', last_name: 'Ek' }),
    ])
    const tool = makeTool()
    const out = (await tool.execute({ name: 'Anna' })) as {
      data: Array<{ name: string }>
    }
    expect(out.data).toHaveLength(5)
  })
})

describe('lookup_employee — empty + error paths', () => {
  it('no match → Swedish wrapToolError with spelling guidance', async () => {
    mockFindMany.mockResolvedValue([])
    const tool = makeTool()

    const out = (await tool.execute({ name: 'Okänd' })) as {
      error: boolean
      message: string
      guidance: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/ingen anställd matchade/i)
    expect(out.guidance).toMatch(/stavning/i)
  })

  it('wraps a thrown DB error rather than throwing', async () => {
    mockFindMany.mockRejectedValue(new Error('db down'))
    const tool = makeTool()

    const out = (await tool.execute({ name: 'Anna' })) as {
      error: boolean
      message: string
    }
    expect(out.error).toBe(true)
    expect(out.message).toMatch(/misslyckades.*db down/i)
  })
})

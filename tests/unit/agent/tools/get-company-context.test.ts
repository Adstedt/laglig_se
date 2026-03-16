import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    lawList: {
      findMany: vi.fn(),
    },
    lawListItem: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { createGetCompanyContextTool } from '@/lib/agent/tools/get-company-context'

const mockProfileFindUnique = vi.mocked(prisma.companyProfile.findUnique)
const mockProfileCreate = vi.mocked(prisma.companyProfile.create)
const mockWorkspaceFindUnique = vi.mocked(prisma.workspace.findUnique)
const mockLawListFindMany = vi.mocked(prisma.lawList.findMany)
const mockLawListItemGroupBy = vi.mocked(prisma.lawListItem.groupBy)
const mockQueryRaw = vi.mocked(prisma.$queryRaw)

const WORKSPACE_ID = 'ws-test-123'

function makeExecuteArgs() {
  return {
    toolCallId: 'tc-1',
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  }
}

describe('get_company_context tool', () => {
  const tool = createGetCompanyContextTool(WORKSPACE_ID)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns full company context with _meta shape', async () => {
    mockProfileFindUnique.mockResolvedValue({
      id: 'profile-1',
      workspace_id: WORKSPACE_ID,
      company_name: 'Testföretaget AB',
      org_number: '556123-4567',
      sni_code: '62010',
      industry_label: 'Dataprogrammering',
      employee_count_range: 'RANGE_10_49',
      organization_type: 'AB',
      compliance_maturity: 'DEVELOPING',
      has_compliance_officer: false,
      certifications: ['ISO 27001'],
      profile_completeness: 85,
      legal_form: null,
      employee_count: null,
      address: null,
      activity_flags: null,
      last_onboarding_at: null,
      municipality: null,
      website_url: null,
      founded_year: null,
      has_collective_agreement: false,
      collective_agreement_name: null,
      workforce_composition: null,
      revenue_range: null,
      business_description: null,
      tax_status: null,
      foreign_owned: false,
      parent_company_name: null,
      parent_company_orgnr: null,
      fi_regulated: false,
      active_status: null,
      ongoing_procedures: null,
      registered_date: null,
      data_source: null,
      last_enriched_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)

    mockLawListFindMany.mockResolvedValue([
      { name: 'Arbetsmiljö', _count: { items: 12 } },
      { name: 'GDPR', _count: { items: 5 } },
    ] as never)

    mockLawListItemGroupBy.mockResolvedValue([
      { compliance_status: 'UPPFYLLD', _count: 8 },
      { compliance_status: 'PAGAENDE', _count: 6 },
      { compliance_status: 'EJ_PABORJAD', _count: 3 },
    ] as never)

    mockQueryRaw.mockResolvedValue([{ count: BigInt(4) }] as never)

    const result = await tool.execute({}, makeExecuteArgs())

    // Verify _meta shape
    expect(result).toHaveProperty('_meta')
    expect(result._meta.tool).toBe('get_company_context')
    expect(result._meta.resultCount).toBe(1)
    expect(typeof result._meta.executionTimeMs).toBe('number')

    // Verify data shape
    const data = (result as { data: Record<string, unknown> }).data
    expect(data.companyName).toBe('Testföretaget AB')
    expect(data.orgNumber).toBe('556123-4567')
    expect(data.sniCode).toBe('62010')
    expect(data.industryLabel).toBe('Dataprogrammering')
    expect(data.employeeCountRange).toBe('RANGE_10_49')
    expect(data.profileCompleteness).toBe(85)
    expect(data.profileComplete).toBe(true)
    expect(data.hasComplianceOfficer).toBe(false)
    expect(data.certifications).toEqual(['ISO 27001'])

    // Law lists
    const lawLists = data.lawLists as Array<Record<string, unknown>>
    expect(lawLists).toHaveLength(2)
    expect(lawLists[0]).toEqual({ name: 'Arbetsmiljö', itemCount: 12 })

    // Compliance distribution
    expect(data.complianceStatusDistribution).toEqual({
      UPPFYLLD: 8,
      PAGAENDE: 6,
      EJ_PABORJAD: 3,
    })

    // Unacknowledged changes
    expect(data.unacknowledgedChangeCount).toBe(4)
  })

  it('gracefully handles NULL profile fields with profileComplete: false', async () => {
    mockProfileFindUnique.mockResolvedValue({
      id: 'profile-2',
      workspace_id: WORKSPACE_ID,
      company_name: 'Nytt Företag',
      org_number: null,
      sni_code: null,
      industry_label: null,
      employee_count_range: null,
      organization_type: null,
      compliance_maturity: null,
      has_compliance_officer: false,
      certifications: [],
      profile_completeness: 10,
      legal_form: null,
      employee_count: null,
      address: null,
      activity_flags: null,
      last_onboarding_at: null,
      municipality: null,
      website_url: null,
      founded_year: null,
      has_collective_agreement: false,
      collective_agreement_name: null,
      workforce_composition: null,
      revenue_range: null,
      business_description: null,
      tax_status: null,
      foreign_owned: false,
      parent_company_name: null,
      parent_company_orgnr: null,
      fi_regulated: false,
      active_status: null,
      ongoing_procedures: null,
      registered_date: null,
      data_source: null,
      last_enriched_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)

    mockLawListFindMany.mockResolvedValue([] as never)
    mockLawListItemGroupBy.mockResolvedValue([] as never)
    mockQueryRaw.mockResolvedValue([{ count: BigInt(0) }] as never)

    const result = await tool.execute({}, makeExecuteArgs())

    const data = (result as { data: Record<string, unknown> }).data
    expect(data.companyName).toBe('Nytt Företag')
    expect(data.orgNumber).toBeNull()
    expect(data.sniCode).toBeNull()
    expect(data.industryLabel).toBeNull()
    expect(data.employeeCountRange).toBeNull()
    expect(data.profileCompleteness).toBe(10)
    expect(data.profileComplete).toBe(false)
    expect(data.lawLists).toEqual([])
    expect(data.complianceStatusDistribution).toEqual({})
    expect(data.unacknowledgedChangeCount).toBe(0)
  })

  it('auto-creates profile when none exists', async () => {
    mockProfileFindUnique.mockResolvedValue(null)
    mockWorkspaceFindUnique.mockResolvedValue({
      name: 'Auto Workspace',
    } as never)
    mockProfileCreate.mockResolvedValue({
      id: 'profile-new',
      workspace_id: WORKSPACE_ID,
      company_name: 'Auto Workspace',
      org_number: null,
      sni_code: null,
      industry_label: null,
      employee_count_range: null,
      organization_type: null,
      compliance_maturity: null,
      has_compliance_officer: false,
      certifications: [],
      profile_completeness: 0,
      legal_form: null,
      employee_count: null,
      address: null,
      activity_flags: null,
      last_onboarding_at: null,
      municipality: null,
      website_url: null,
      founded_year: null,
      has_collective_agreement: false,
      collective_agreement_name: null,
      workforce_composition: null,
      revenue_range: null,
      business_description: null,
      tax_status: null,
      foreign_owned: false,
      parent_company_name: null,
      parent_company_orgnr: null,
      fi_regulated: false,
      active_status: null,
      ongoing_procedures: null,
      registered_date: null,
      data_source: null,
      last_enriched_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)

    mockLawListFindMany.mockResolvedValue([] as never)
    mockLawListItemGroupBy.mockResolvedValue([] as never)
    mockQueryRaw.mockResolvedValue([{ count: BigInt(0) }] as never)

    const result = await tool.execute({}, makeExecuteArgs())

    expect(mockProfileCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: WORKSPACE_ID,
        company_name: 'Auto Workspace',
      },
    })

    const data = (result as { data: Record<string, unknown> }).data
    expect(data.companyName).toBe('Auto Workspace')
    expect(data.profileComplete).toBe(false)
  })

  it('returns enrichment fields when populated', async () => {
    const regDate = new Date('2018-06-15')
    const enrichedAt = new Date('2026-03-10')
    mockProfileFindUnique.mockResolvedValue({
      id: 'profile-enriched',
      workspace_id: WORKSPACE_ID,
      company_name: 'Enriched AB',
      org_number: '556999-1234',
      sni_code: '62010',
      industry_label: 'Dataprogrammering',
      employee_count_range: 'RANGE_10_49',
      organization_type: 'AB',
      compliance_maturity: 'DEVELOPING',
      has_compliance_officer: false,
      certifications: [],
      profile_completeness: 90,
      legal_form: null,
      employee_count: null,
      address: null,
      activity_flags: null,
      last_onboarding_at: null,
      municipality: null,
      website_url: null,
      founded_year: null,
      has_collective_agreement: false,
      collective_agreement_name: null,
      workforce_composition: null,
      revenue_range: null,
      business_description: 'IT-konsultföretag med fokus på compliance',
      tax_status: { f_tax: true, vat: true, employer: true },
      foreign_owned: true,
      parent_company_name: 'Global Corp Ltd',
      parent_company_orgnr: null,
      fi_regulated: true,
      active_status: 'active',
      ongoing_procedures: {
        liquidation: false,
        restructuring: false,
        bankruptcy: false,
      },
      registered_date: regDate,
      data_source: 'bolagsapi',
      last_enriched_at: enrichedAt,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)

    mockLawListFindMany.mockResolvedValue([] as never)
    mockLawListItemGroupBy.mockResolvedValue([] as never)
    mockQueryRaw.mockResolvedValue([{ count: BigInt(0) }] as never)

    const result = await tool.execute({}, makeExecuteArgs())
    const data = (result as { data: Record<string, unknown> }).data

    expect(data.businessDescription).toBe(
      'IT-konsultföretag med fokus på compliance'
    )
    expect(data.taxStatus).toEqual({ f_tax: true, vat: true, employer: true })
    expect(data.foreignOwned).toBe(true)
    expect(data.parentCompanyName).toBe('Global Corp Ltd')
    expect(data.fiRegulated).toBe(true)
    expect(data.activeStatus).toBe('active')
    expect(data.ongoingProcedures).toEqual({
      liquidation: false,
      restructuring: false,
      bankruptcy: false,
    })
    expect(data.registeredDate).toBe(regDate.toISOString())
    expect(data.dataSource).toBe('bolagsapi')
    expect(data.lastEnrichedAt).toBe(enrichedAt.toISOString())
  })

  it('returns null enrichment fields for unenriched profile', async () => {
    mockProfileFindUnique.mockResolvedValue({
      id: 'profile-2',
      workspace_id: WORKSPACE_ID,
      company_name: 'Nytt Företag',
      org_number: null,
      sni_code: null,
      industry_label: null,
      employee_count_range: null,
      organization_type: null,
      compliance_maturity: null,
      has_compliance_officer: false,
      certifications: [],
      profile_completeness: 10,
      legal_form: null,
      employee_count: null,
      address: null,
      activity_flags: null,
      last_onboarding_at: null,
      municipality: null,
      website_url: null,
      founded_year: null,
      has_collective_agreement: false,
      collective_agreement_name: null,
      workforce_composition: null,
      revenue_range: null,
      business_description: null,
      tax_status: null,
      foreign_owned: false,
      parent_company_name: null,
      parent_company_orgnr: null,
      fi_regulated: false,
      active_status: null,
      ongoing_procedures: null,
      registered_date: null,
      data_source: null,
      last_enriched_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as never)

    mockLawListFindMany.mockResolvedValue([] as never)
    mockLawListItemGroupBy.mockResolvedValue([] as never)
    mockQueryRaw.mockResolvedValue([{ count: BigInt(0) }] as never)

    const result = await tool.execute({}, makeExecuteArgs())
    const data = (result as { data: Record<string, unknown> }).data

    expect(data.businessDescription).toBeNull()
    expect(data.taxStatus).toBeNull()
    expect(data.foreignOwned).toBe(false)
    expect(data.parentCompanyName).toBeNull()
    expect(data.fiRegulated).toBe(false)
    expect(data.activeStatus).toBeNull()
    expect(data.ongoingProcedures).toBeNull()
    expect(data.registeredDate).toBeNull()
    expect(data.dataSource).toBeNull()
    expect(data.lastEnrichedAt).toBeNull()
  })

  it('returns error with Swedish guidance on failure', async () => {
    mockProfileFindUnique.mockRejectedValue(new Error('Connection refused'))

    const result = await tool.execute({}, makeExecuteArgs())

    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('Connection refused'),
      _meta: { tool: 'get_company_context', resultCount: 0 },
    })
    expect((result as { guidance: string }).guidance).toContain('Försök igen')
  })
})

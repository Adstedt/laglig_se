/**
 * Story 14.4: Tests for company profile server actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
const { mockCompanyProfileUpdate } = vi.hoisted(() => ({
  mockCompanyProfileUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUniqueOrThrow: vi.fn(),
    },
    companyProfile: {
      upsert: vi.fn(),
      update: mockCompanyProfileUpdate,
    },
    $transaction: vi.fn((cb: (_tx: unknown) => Promise<unknown>) =>
      cb({
        companyProfile: {
          update: mockCompanyProfileUpdate,
        },
      })
    ),
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  getWorkspaceContext: vi.fn(),
  WorkspaceAccessError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.name = 'WorkspaceAccessError'
      this.code = code
    }
  },
}))

vi.mock('@/lib/auth/permissions', () => ({
  hasPermission: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  getCompanyProfile,
  updateCompanyProfile,
} from '@/app/actions/company-profile'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'
import { prisma } from '@/lib/prisma'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

const mockContext = {
  userId: 'user_123',
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as const,
  role: 'OWNER' as const,
  hasPermission: () => true,
}

const mockProfile = {
  id: 'profile_123',
  workspace_id: 'ws_123',
  company_name: 'Test AB',
  sni_code: null,
  legal_form: null,
  employee_count: null,
  address: null,
  contextual_answers: null,
  org_number: null,
  organization_type: null,
  industry_label: null,
  employee_count_range: null,
  activity_flags: null,
  certifications: [],
  compliance_maturity: null,
  has_compliance_officer: false,
  profile_completeness: 0,
  last_onboarding_at: null,
  // Phase 2 fields
  municipality: null,
  website_url: null,
  founded_year: null,
  has_collective_agreement: false,
  collective_agreement_name: null,
  workforce_composition: null,
  revenue_range: null,
}

describe('getCompanyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext as never)
    vi.mocked(prisma.workspace.findUniqueOrThrow).mockResolvedValue({
      name: 'Test Workspace',
    } as never)
  })

  it('creates profile when none exists (lazy creation via upsert)', async () => {
    vi.mocked(prisma.companyProfile.upsert).mockResolvedValue(
      mockProfile as never
    )

    const result = await getCompanyProfile()

    expect(prisma.companyProfile.upsert).toHaveBeenCalledWith({
      where: { workspace_id: 'ws_123' },
      create: {
        workspace_id: 'ws_123',
        company_name: 'Test Workspace',
      },
      update: {},
    })
    expect(result).toEqual(mockProfile)
  })

  it('returns existing profile when one exists', async () => {
    const existingProfile = { ...mockProfile, company_name: 'Existing AB' }
    vi.mocked(prisma.companyProfile.upsert).mockResolvedValue(
      existingProfile as never
    )

    const result = await getCompanyProfile()

    expect(result.company_name).toBe('Existing AB')
  })

  it('throws when user has no workspace membership', async () => {
    const { WorkspaceAccessError } = await import(
      '@/lib/auth/workspace-context'
    )
    vi.mocked(getWorkspaceContext).mockRejectedValue(
      new WorkspaceAccessError('No workspace access', 'NO_WORKSPACE')
    )

    await expect(getCompanyProfile()).rejects.toThrow('No workspace access')
  })
})

describe('updateCompanyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceContext).mockResolvedValue(mockContext as never)
    vi.mocked(hasPermission).mockReturnValue(true)
    mockCompanyProfileUpdate.mockResolvedValue(mockProfile as never)
  })

  it('updates fields and returns success with profile_completeness', async () => {
    const updatedProfile = {
      ...mockProfile,
      company_name: 'Updated AB',
      organization_type: 'AB' as const,
    }
    mockCompanyProfileUpdate.mockResolvedValue(updatedProfile as never)

    const result = await updateCompanyProfile({
      company_name: 'Updated AB',
      organization_type: 'AB',
    })

    expect(result.success).toBe(true)
    expect(result.message).toBe('Företagsprofil uppdaterad')
    expect(result.profile_completeness).toBe(20) // company_name(10) + org_type(10)
    expect(mockCompanyProfileUpdate).toHaveBeenCalled()
  })

  it('rejects invalid enum value', async () => {
    const result = await updateCompanyProfile({
      // @ts-expect-error — testing invalid enum value
      organization_type: 'INVALID_TYPE',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects unauthorized user (no workspace:settings permission)', async () => {
    vi.mocked(hasPermission).mockReturnValue(false)

    const result = await updateCompanyProfile({
      company_name: 'Should Not Work',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Åtkomst nekad')
  })

  it('accepts new phase 2 fields', async () => {
    const updatedProfile = {
      ...mockProfile,
      municipality: 'Stockholm',
      website_url: 'https://example.se',
      founded_year: 2015,
      has_collective_agreement: true,
      collective_agreement_name: 'Teknikavtalet',
      workforce_composition: 'MIXED' as const,
      revenue_range: 'RANGE_3M_TO_40M' as const,
    }
    mockCompanyProfileUpdate.mockResolvedValue(updatedProfile as never)

    const result = await updateCompanyProfile({
      municipality: 'Stockholm',
      website_url: 'https://example.se',
      founded_year: 2015,
      has_collective_agreement: true,
      collective_agreement_name: 'Teknikavtalet',
      workforce_composition: 'MIXED',
      revenue_range: 'RANGE_3M_TO_40M',
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid workforce_composition enum', async () => {
    const result = await updateCompanyProfile({
      // @ts-expect-error — testing invalid enum value
      workforce_composition: 'INVALID',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('calculateProfileCompleteness', () => {
  const emptyProfile = {
    company_name: '',
    organization_type: null,
    industry_label: null,
    employee_count_range: null,
    municipality: null,
    sni_code: null,
    activity_flags: null,
    certifications: [],
    compliance_maturity: null,
    workforce_composition: null,
    revenue_range: null,
    founded_year: null,
    has_collective_agreement: false,
    website_url: null,
    collective_agreement_name: null,
  }

  it('returns 0 when all fields empty', () => {
    const result = calculateProfileCompleteness(emptyProfile)
    expect(result).toBe(0)
  })

  it('returns 50 when only core fields filled', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      company_name: 'Test AB',
      organization_type: 'AB',
      industry_label: 'IT',
      employee_count_range: 'RANGE_10_49',
      municipality: 'Stockholm',
    })

    expect(result).toBe(50)
  })

  it('returns 50 when only extended fields filled', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      sni_code: '62010',
      activity_flags: { chemicals: true, construction: false },
      certifications: ['ISO 45001'],
      compliance_maturity: 'BASIC',
      workforce_composition: 'MIXED',
      revenue_range: 'RANGE_3M_TO_40M',
      founded_year: 2015,
      has_collective_agreement: true,
      website_url: 'https://example.se',
      collective_agreement_name: 'Teknikavtalet',
    })

    expect(result).toBe(50)
  })

  it('returns 100 when all fields filled', () => {
    const result = calculateProfileCompleteness({
      company_name: 'Test AB',
      organization_type: 'AB',
      industry_label: 'IT',
      employee_count_range: 'RANGE_10_49',
      municipality: 'Stockholm',
      sni_code: '62010',
      activity_flags: { chemicals: true },
      certifications: ['ISO 45001'],
      compliance_maturity: 'ESTABLISHED',
      workforce_composition: 'MIXED',
      revenue_range: 'RANGE_3M_TO_40M',
      founded_year: 2015,
      has_collective_agreement: true,
      website_url: 'https://example.se',
      collective_agreement_name: 'Teknikavtalet',
    })

    expect(result).toBe(100)
  })

  it('calculates partial fill correctly (company_name 10 + sni_code 5 = 15)', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      company_name: 'Test AB',
      sni_code: '62010',
    })

    expect(result).toBe(15)
  })

  it('does not count activity_flags if all flags are false', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      activity_flags: {
        chemicals: false,
        construction: false,
        food: false,
        personalData: false,
        publicSector: false,
        heavyMachinery: false,
        minorEmployees: false,
        internationalOperations: false,
      },
    })

    expect(result).toBe(0)
  })

  it('does not count empty certifications array', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      company_name: 'Test AB',
      certifications: [],
    })

    expect(result).toBe(10)
  })

  it('counts new extended fields individually at 5% each', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      workforce_composition: 'MOSTLY_WORKERS',
      revenue_range: 'UNDER_3M',
      founded_year: 2020,
    })

    expect(result).toBe(15) // 3 × 5%
  })

  it('counts municipality as core field at 10%', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      municipality: 'Göteborg',
    })

    expect(result).toBe(10)
  })

  it('counts collective agreement fields', () => {
    const result = calculateProfileCompleteness({
      ...emptyProfile,
      has_collective_agreement: true,
      collective_agreement_name: 'Teknikavtalet',
    })

    expect(result).toBe(10) // 2 × 5%
  })
})

import { describe, it, expect, vi } from 'vitest'

// Mock prisma before imports (system-prompt.ts now imports it for change context)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    changeEvent: { findUnique: vi.fn() },
    amendmentDocument: { findFirst: vi.fn() },
    legalDocument: { findUnique: vi.fn() },
  },
}))

// Mock effective-date to avoid DB calls in unit tests
vi.mock('@/lib/utils/effective-date', () => ({
  resolveEffectiveDate: vi.fn().mockResolvedValue(null),
  getEffectiveDateBadge: vi
    .fn()
    .mockReturnValue({ text: 'Okänt', variant: 'gray' }),
}))

import {
  buildSystemPrompt,
  formatCompanyContext,
} from '@/lib/agent/system-prompt'
import { prisma } from '@/lib/prisma'
import type { CompanyProfile } from '@prisma/client'

// ---------------------------------------------------------------------------
// Helper: create a CompanyProfile-like object
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    id: 'cp-1',
    workspace_id: 'ws-1',
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
    municipality: null,
    website_url: null,
    founded_year: null,
    has_collective_agreement: false,
    collective_agreement_name: null,
    workforce_composition: null,
    revenue_range: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as CompanyProfile
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('returns a Swedish prompt containing all required sections', async () => {
    const prompt = await buildSystemPrompt()

    // Role (AC 3)
    expect(prompt).toContain('<role>')
    expect(prompt).toContain('compliance-partner')

    // Knowledge boundary (AC 4)
    expect(prompt).toContain('<knowledge_boundary>')
    expect(prompt).toContain('baserar dina svar')

    // Citation rules (AC 5)
    expect(prompt).toContain('<citation_rules>')
    expect(prompt).toContain('[Källa: SFS 1977:1160, Kap 2, 3 §]')

    // Fact vs advice (AC 6)
    expect(prompt).toContain('Lagen säger')
    expect(prompt).toContain('Ni bör överväga')

    // Tool guidance (AC 8)
    expect(prompt).toContain('<tool_guidance>')
    expect(prompt).toContain('get_company_context')
    expect(prompt).toContain('execute: false')

    // Guardrails (AC 9-12)
    expect(prompt).toContain('<guardrails>')
    expect(prompt).toContain('konsulterar en jurist')
    expect(prompt).toContain('ersätter inte juridisk rådgivning')

    // Fallback (AC 17-18)
    expect(prompt).toContain('<fallback_behavior>')

    // Examples
    expect(prompt).toContain('<examples>')
    expect(prompt).toContain('<example_good>')
    expect(prompt).toContain('<example_bad>')

    // Workflow
    expect(prompt).toContain('<workflow>')

    // Query types
    expect(prompt).toContain('<query_types>')

    // Common pitfalls
    expect(prompt).toContain('<common_pitfalls>')

    // suggest_followups tool guidance
    expect(prompt).toContain('suggest_followups')
  })

  it('includes company context section when companyContext is provided', async () => {
    const prompt = await buildSystemPrompt({
      companyContext: '- Företag: Acme AB\n- Bransch: Bygg',
    })

    expect(prompt).toContain('<company_context>')
    expect(prompt).toContain('Om företaget')
    expect(prompt).toContain('Acme AB')
    expect(prompt).toContain('Bygg')
  })

  it('omits company context section when companyContext is undefined', async () => {
    const prompt = await buildSystemPrompt({})
    expect(prompt).not.toContain('<company_context>')
  })

  it('includes task context for contextType=task', async () => {
    const prompt = await buildSystemPrompt({
      contextType: 'task',
      title: 'Granska arbetsmiljöpolicy',
      summary: 'Årlig granskning',
    })

    expect(prompt).toContain('<task_context>')
    expect(prompt).toContain('Granska arbetsmiljöpolicy')
    expect(prompt).toContain('Årlig granskning')
    expect(prompt).toContain('Fokusera svaren på denna uppgift')
  })

  it('includes law context for contextType=law', async () => {
    const prompt = await buildSystemPrompt({
      contextType: 'law',
      sfsNumber: 'SFS 1977:1160',
      title: 'Arbetsmiljölagen',
    })

    expect(prompt).toContain('<task_context>')
    expect(prompt).toContain('Arbetsmiljölagen')
    expect(prompt).toContain('SFS 1977:1160')
    expect(prompt).toContain('Fokusera svaren på denna lag')
  })

  it('includes suggest_followups in assessment workflow for change context', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-2',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: null,
      ai_summary: null,
      changed_sections: null,
      diff_summary: null,
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-2',
    })

    expect(prompt).toContain('<assessment_workflow>')
    expect(prompt).toContain('suggest_followups')
  })

  it('includes change context for contextType=change', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-1',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:100',
      ai_summary: 'Ändring av 3 §',
      changed_sections: ['3 §', '5 §'],
      document: {
        title: 'Arbetsmiljölagen',
        document_number: 'SFS 1977:1160',
        effective_date: null,
      },
    } as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-1',
    })

    expect(prompt).toContain('<change_context>')
    expect(prompt).toContain('AMENDMENT')
    expect(prompt).toContain('SFS 2026:100')
    expect(prompt).toContain('Arbetsmiljölagen')
    expect(prompt).toContain('Ändring av 3 §')
    expect(prompt).toContain('3 §, 5 §')
  })

  it('stays within approximate token budget (~2000-4000 tokens)', async () => {
    const prompt = await buildSystemPrompt()
    // Rough approximation: 1 token ≈ 4 characters for Swedish text
    const estimatedTokens = prompt.length / 4
    expect(estimatedTokens).toBeGreaterThan(1500)
    expect(estimatedTokens).toBeLessThan(4000)
  })
})

// ---------------------------------------------------------------------------
// formatCompanyContext
// ---------------------------------------------------------------------------

describe('formatCompanyContext', () => {
  it('returns undefined for null profile', () => {
    expect(formatCompanyContext(null)).toBeUndefined()
  })

  it('returns undefined when all extended fields are null', () => {
    const profile = makeProfile({
      company_name: '', // empty string — truthy check fails
      org_number: null,
      industry_label: null,
      sni_code: null,
      employee_count_range: null,
      certifications: [],
      compliance_maturity: null,
      activity_flags: null,
    })
    // company_name is empty string — falsy
    expect(formatCompanyContext(profile)).toBeUndefined()
  })

  it('formats all fields correctly for a full profile', () => {
    const profile = makeProfile({
      company_name: 'Acme AB',
      org_number: '556123-4567',
      industry_label: 'Tillverkning',
      sni_code: '25110',
      employee_count_range: 'RANGE_50_249',
      certifications: ['ISO 14001', 'ISO 9001'],
      compliance_maturity: 'ESTABLISHED',
      activity_flags: {
        chemicals: true,
        construction: false,
        personalData: true,
      },
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Acme AB')
    expect(result).toContain('556123-4567')
    expect(result).toContain('Tillverkning (SNI 25110)')
    expect(result).toContain('50–249')
    expect(result).toContain('ISO 14001, ISO 9001')
    expect(result).toContain('Etablerad')
    expect(result).toContain('Hanterar kemikalier')
    expect(result).toContain('Behandlar personuppgifter')
    expect(result).not.toContain('Byggverksamhet') // construction: false
  })

  it('skips null fields and includes only available ones', () => {
    const profile = makeProfile({
      company_name: 'Liten Firma HB',
      org_number: null,
      industry_label: null,
      sni_code: null,
      employee_count_range: 'RANGE_1_9',
      certifications: [],
      compliance_maturity: null,
      activity_flags: null,
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Liten Firma HB')
    expect(result).toContain('1–9')
    expect(result).not.toContain('Organisationsnummer')
    expect(result).not.toContain('Bransch')
    expect(result).not.toContain('Certifieringar')
    expect(result).not.toContain('Compliance-mognad')
  })
})

import { describe, it, expect, vi } from 'vitest'

// Mock prisma before imports (system-prompt.ts now imports it for change context)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    changeEvent: { findUnique: vi.fn() },
    amendmentDocument: { findFirst: vi.fn() },
    sectionChange: { findMany: vi.fn() },
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
    // Story 14.23 removed the `execute: false` direct-write branch — write tools
    // now propose via the inline approval card ("förslagskort"). Assert the
    // current model rather than the retired execute:false phrasing.
    expect(prompt).toContain('förslagskort')

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

  // Story 17.9c (AC 8): the prompt must surface the workspace-files search tool.
  it('includes search_workspace_files tool guidance (Story 17.9c, AC 8)', async () => {
    const prompt = await buildSystemPrompt()
    expect(prompt).toContain('search_workspace_files')
    // Tells the agent to cite uploaded-file hits by filename.
    expect(prompt).toContain('[Källa: rutin.pdf]')
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

  it('includes section changes from SectionChange table in change context', async () => {
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

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue({ id: 'amd-1' } as never)

    const mockFindMany = vi.mocked(prisma.sectionChange.findMany)
    mockFindMany.mockResolvedValue([
      { chapter: '2', section: '3', change_type: 'AMENDED' },
      { chapter: null, section: '5', change_type: 'NEW' },
      { chapter: '4', section: '1', change_type: 'REPEALED' },
    ] as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-1',
    })

    expect(prompt).toContain('<change_context>')
    expect(prompt).toContain('AMENDMENT')
    expect(prompt).toContain('SFS 2026:100')
    expect(prompt).toContain('Arbetsmiljölagen')
    expect(prompt).toContain('Ändring av 3 §')
    expect(prompt).toContain(
      'Kap 2 § 3 (ändrad), § 5 (ny), Kap 4 § 1 (upphävd)'
    )
  })

  it('includes amendment full text instead of diff when available', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-5',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:500',
      ai_summary: null,
      changed_sections: null,
      diff_summary: '--- old\n+++ new\n@@ -1,3 +1,3 @@\n-gammal text\n+ny text',
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue({
      id: 'amd-5',
      full_text:
        'Lag om ändring i testlagen\n\n1 § ska ha följande lydelse.\n\n1 § Ny lydelse av paragrafen.',
    } as never)

    const mockFindMany = vi.mocked(prisma.sectionChange.findMany)
    mockFindMany.mockResolvedValue([
      { chapter: null, section: '1', change_type: 'AMENDED' },
    ] as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-5',
    })

    // Should include amendment full text
    expect(prompt).toContain(
      'Ändringstext (från den publicerade författningen)'
    )
    expect(prompt).toContain('Lag om ändring i testlagen')
    expect(prompt).toContain('1 § ska ha följande lydelse')

    // Should NOT include diff when amendment text is present
    expect(prompt).not.toContain('Ändringar (diff)')
    expect(prompt).not.toContain('gammal text')
  })

  it('includes proposition context when available', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-6',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:600',
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue({
      id: 'amd-6',
      full_text: 'Lag om ändring...',
      proposition_title: 'Begränsad tillgång till lustgas',
      proposition_summary: 'I propositionen föreslås en ny lag om lustgas.',
      proposition_organ: 'Socialdepartementet',
    } as never)

    const mockFindMany = vi.mocked(prisma.sectionChange.findMany)
    mockFindMany.mockResolvedValue([] as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-6',
    })

    expect(prompt).toContain('Bakgrund (från propositionen)')
    expect(prompt).toContain('Begränsad tillgång till lustgas')
    expect(prompt).toContain('Socialdepartementet')
    expect(prompt).toContain('ny lag om lustgas')
  })

  it('omits proposition section when not available', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-7',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:700',
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Förordningen',
        document_number: 'SFS 2020:3',
        effective_date: null,
      },
    } as never)

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue({
      id: 'amd-7',
      full_text: 'Regeringen föreskriver...',
      proposition_title: null,
      proposition_summary: null,
      proposition_organ: null,
    } as never)

    const mockFindMany = vi.mocked(prisma.sectionChange.findMany)
    mockFindMany.mockResolvedValue([] as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-7',
    })

    expect(prompt).not.toContain('Bakgrund (från propositionen)')
  })

  it('omits section line when no SectionChange records exist', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-3',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:200',
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue({ id: 'amd-2' } as never)

    const mockFindMany = vi.mocked(prisma.sectionChange.findMany)
    mockFindMany.mockResolvedValue([] as never)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-3',
    })

    expect(prompt).toContain('<change_context>')
    expect(prompt).not.toContain('Berörda paragrafer')
  })

  it('omits section line when no AmendmentDocument matches', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-4',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: 'SFS 2026:999',
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Okänd lag',
        document_number: 'SFS 2020:2',
        effective_date: null,
      },
    } as never)

    const mockFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
    mockFindFirst.mockResolvedValue(null)

    const prompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-4',
    })

    expect(prompt).toContain('<change_context>')
    expect(prompt).not.toContain('Berörda paragrafer')
  })

  it('LAW block surfaces the law-list item id when provided (Story 19.4a)', async () => {
    const prompt = await buildSystemPrompt({
      contextType: 'law',
      title: 'Arbetsmiljölag',
      sfsNumber: 'SFS 1977:1160',
      lawListItemId: 'item-1',
    })
    expect(prompt).toContain('Aktiv laglistpost-ID: item-1')
    expect(prompt).toContain('Arbetsmiljölag (SFS 1977:1160)')
  })

  it('LAW block omits the id line when lawListItemId is undefined (SF-2)', async () => {
    const prompt = await buildSystemPrompt({
      contextType: 'law',
      title: 'Arbetsmiljölag',
      sfsNumber: 'SFS 1977:1160',
    })
    expect(prompt).not.toContain('Aktiv laglistpost-ID')
    expect(prompt).toContain('Arbetsmiljölag (SFS 1977:1160)')
  })

  it('includes read-before-propose steering for the entity-readers (Story 19.4)', async () => {
    const prompt = await buildSystemPrompt()
    expect(prompt).toContain('get_law_list_item')
    // the read-before-propose instruction must be present
    expect(prompt).toContain('INNAN du föreslår update_compliance_status')
  })

  it('stays within approximate token budget (~2000-5500 tokens)', async () => {
    const prompt = await buildSystemPrompt()
    // Rough approximation: 1 token ≈ 4 characters for Swedish text.
    // Ceiling re-baselined 4000 → 5500: the base prompt legitimately grew with
    // the Story 14.23 inline-approval ("förslagskort") guidance + the 17.9c/19.2
    // tool bullets (~4.5k tokens now). This stays a guard against runaway growth;
    // revisit when the 19.6 skills layer lands (candidate for the structured-parts
    // / prompt-caching v2 refactor noted in Story 14.26).
    const estimatedTokens = prompt.length / 4
    expect(estimatedTokens).toBeGreaterThan(1500)
    expect(estimatedTokens).toBeLessThan(5500)
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

  it('includes all enrichment fields when populated', () => {
    const profile = makeProfile({
      company_name: 'Enriched AB',
      business_description: 'Tillverkning av industriella komponenter',
      registered_date: new Date('2015-03-20'),
      tax_status: { f_tax: true, vat: true, employer: false },
      foreign_owned: true,
      parent_company_name: 'Global Corp Ltd',
      fi_regulated: true,
      ongoing_procedures: {
        liquidation: false,
        restructuring: true,
        bankruptcy: false,
      },
      active_status: 'deregistered',
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain(
      'Verksamhet: Tillverkning av industriella komponenter'
    )
    expect(result).toContain('Registrerad: 2015')
    expect(result).toContain('F-skatt: Ja')
    expect(result).toContain('Momsregistrerad: Ja')
    expect(result).toContain('Registrerad arbetsgivare: Nej')
    expect(result).toContain('Utlandsägt: Ja (moderbolag: Global Corp Ltd)')
    expect(result).toContain('Finansinspektionen-reglerad: Ja')
    expect(result).toContain('Pågående förfaranden: Rekonstruktion')
    expect(result).toContain('Status: Avregistrerad')
  })

  it('backward compat: enrichment fields null/false produce identical output', () => {
    const profile = makeProfile({
      company_name: 'Legacy AB',
      org_number: '556000-0000',
      industry_label: 'Bygg',
      sni_code: '41200',
      employee_count_range: 'RANGE_10_49',
      certifications: ['ISO 9001'],
      compliance_maturity: 'BASIC',
      activity_flags: { chemicals: true },
    })

    const result = formatCompanyContext(profile)!
    // New enrichment lines should NOT appear
    expect(result).not.toContain('Verksamhet:')
    expect(result).not.toContain('Registrerad:')
    expect(result).not.toContain('F-skatt:')
    expect(result).not.toContain('Utlandsägt:')
    expect(result).not.toContain('Finansinspektionen')
    expect(result).not.toContain('Pågående förfaranden')
    expect(result).not.toContain('Status:')
    // Existing lines still present
    expect(result).toContain('Legacy AB')
    expect(result).toContain('Bygg (SNI 41200)')
    expect(result).toContain('Hanterar kemikalier')
  })

  it('partial enrichment: only business_description set', () => {
    const profile = makeProfile({
      company_name: 'Partial AB',
      business_description: 'Konsultverksamhet inom IT',
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Verksamhet: Konsultverksamhet inom IT')
    expect(result).not.toContain('F-skatt')
    expect(result).not.toContain('Utlandsägt')
  })

  it('foreign_owned true with parent_company_name shows moderbolag', () => {
    const profile = makeProfile({
      company_name: 'Foreign AB',
      foreign_owned: true,
      parent_company_name: 'Mother Inc',
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Utlandsägt: Ja (moderbolag: Mother Inc)')
  })

  it('active_status "deregistered" shows status line', () => {
    const profile = makeProfile({
      company_name: 'Closed AB',
      active_status: 'deregistered',
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Status: Avregistrerad')
  })

  it('active_status "active" does not show status line', () => {
    const profile = makeProfile({
      company_name: 'Active AB',
      active_status: 'active',
    })

    const result = formatCompanyContext(profile)!
    expect(result).not.toContain('Status:')
  })

  it('skips null tax_status fields instead of showing Nej', () => {
    const profile = makeProfile({
      company_name: 'Null Employer AB',
      tax_status: { f_tax: true, vat: true, employer: null },
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('F-skatt: Ja')
    expect(result).toContain('Momsregistrerad: Ja')
    expect(result).not.toContain('Registrerad arbetsgivare')
  })

  it('uses founded_year as fallback when registered_date is null', () => {
    const profile = makeProfile({
      company_name: 'Old AB',
      founded_year: 1998,
    })

    const result = formatCompanyContext(profile)!
    expect(result).toContain('Registrerad: 1998')
  })
})

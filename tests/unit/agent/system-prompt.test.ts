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
  formatEmployeeContext,
  type EmployeeContextEmployee,
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

  // Story 17.10 (AC 18): the prompt must surface all three workspace-document
  // read tools (search / get / list) so the agent knows when to reach for them.
  it('includes the three workspace-document tools (Story 17.10, AC 18)', async () => {
    const prompt = await buildSystemPrompt()
    expect(prompt).toContain('search_workspace_documents')
    expect(prompt).toContain('get_workspace_document')
    expect(prompt).toContain('list_workspace_documents')
    // DEC-2: cite styrdokument by title. The new guidance line carries an
    // explicit example.
    expect(prompt).toContain('[Källa: Dataskyddspolicy]')
  })

  // Story 17.10b AC 12 / AC 14: status-aware hedging directive. The agent
  // MUST be told to differentiate APPROVED hits (Källa, canonical) from
  // DRAFT/IN_REVIEW hits (Utkast, hedged). This is the load-bearing safety
  // surface — the prompt-layer half of "do not quote DRAFT as canonical".
  it('teaches status-aware Källa vs Utkast hedging for workspace documents (17.10b AC 12)', async () => {
    const prompt = await buildSystemPrompt()
    // The full directive (substring match — exact wording per the story AC).
    expect(prompt).toContain('Citera APPROVED-träffar som `[Källa: <titel>]`')
    expect(prompt).toContain(
      'Citera DRAFT/IN_REVIEW-träffar som `[Utkast: <titel>]`'
    )
    // The hedging-in-text instruction — agents must phrase non-APPROVED hits
    // as drafts, never as canonical policy.
    expect(prompt).toContain('enligt utkast till')
    expect(prompt).toContain(
      'ALDRIG "enligt …" eller "vår policy säger …" som om utkastet vore gällande policy'
    )
  })

  // Story 17.10b AC 13: a worked mixed-status example so the agent has a
  // concrete pattern to imitate (Källa + Utkast in the same response).
  it('contains a mixed-status worked example for Källa + Utkast (17.10b AC 13)', async () => {
    const prompt = await buildSystemPrompt()
    expect(prompt).toContain('[Utkast: Semesterpolicy]')
    expect(prompt).toContain('pågående utkast')
  })

  // DASH-WRITE-001: explicit rules for resolving lawListItemId in a workspace/
  // global chat before calling write tools. The four rules (Lös upp /
  // Verbalisera / Skicka explicit / Försök inte igen) are the load-bearing
  // safety surface against silent wrong-law attribution. Surfaced 2026-06-02
  // during a dashboard-chat gap-analysis probe where the agent activated
  // gap_analysis, found the right law semantically, but didn't thread the
  // resolved lawListItemId into subsequent write tool calls — and retried
  // the same permanent-rejection error 6 + 2 times before self-diagnosing.
  it('teaches the agent to resolve lawListItemId explicitly in workspace/global chats (DASH-WRITE-001)', async () => {
    const prompt = await buildSystemPrompt()

    // Rule 1: resolve via search_law_list_items, ask on ambiguity, never guess.
    expect(prompt).toContain(
      'Identifiera rätt laglistpost INNAN du anropar skrivverktyg'
    )
    expect(prompt).toContain('search_law_list_items')
    expect(prompt).toContain('TVETYDIGT')
    expect(prompt).toContain('Gissa ALDRIG')

    // Rule 2: verbalise the choice in prose BEFORE creating the proposal card —
    // gives the user a chance to catch wrong-law selection before approval.
    expect(prompt).toContain('Verbalisera valet')
    expect(prompt).toContain('ger användaren en chans att avbryta')

    // Rule 3: pass lawListItemId explicitly; never reuse stale IDs across turns
    // (context may have shifted from one law to another mid-conversation).
    expect(prompt).toContain('Skicka `lawListItemId` explicit')
    expect(prompt).toContain(
      'Återanvänd ALDRIG en UUID från en TIDIGARE konversationstur'
    )

    // Rule 4: no retry-on-permanent-error (partial mitigation for TC-002).
    // The two specific error messages the agent should treat as terminal.
    expect(prompt).toContain(
      'Försök INTE samma verktyg igen utan ändrade indata'
    )
    expect(prompt).toContain('Ingen laglistpost angiven')
    expect(prompt).toContain('Laglistposten hittades inte')
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

    // Story 19.7a: the assessment playbook is now the injected assess_change
    // skill (the ASSESSMENT_WORKFLOW literal was removed).
    expect(prompt).toContain('<skill>')
    expect(prompt).toContain('Bedömningsflöde') // assess_change PROCEDURE body
    expect(prompt).toContain('suggest_followups')
    expect(prompt).not.toContain('<assessment_workflow>')
  })

  it('injects assess_change for change context but not for global (Story 19.7a)', async () => {
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-skill',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: null,
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)

    const changePrompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-skill',
    })
    expect(changePrompt).toContain('<skill>')
    expect(changePrompt).toContain('Bedömningsflöde')

    // Global: no primary skill → no <skill> block, but assess_change is
    // advertised in <available_skills> (activatable via activate_skill).
    const globalPrompt = await buildSystemPrompt({})
    expect(globalPrompt).not.toContain('<skill>')
    expect(globalPrompt).toContain('<available_skills>')
    expect(globalPrompt).toContain('assess_change')
  })

  it('advertises gap_analysis + injects the assess_change current-state read + carries KP-001 framing (Story 19.7b)', async () => {
    // Global: gap_analysis is advertised in <available_skills> (activation-only,
    // never primary → no <skill> block from it). The base prompt carries the
    // KP-001 kravpunkt-framing rule.
    const globalPrompt = await buildSystemPrompt({})
    expect(globalPrompt).toContain('<available_skills>')
    expect(globalPrompt).toContain('gap_analysis')
    expect(globalPrompt).not.toContain('<skill>')
    expect(globalPrompt).toContain('verifierbart krav i påstående-presens') // KP-001

    // Change: the assess_change <skill> body now includes the current-state read
    // prep step (enrichment) — parity directives still present.
    const mockFindUnique = vi.mocked(prisma.changeEvent.findUnique)
    mockFindUnique.mockResolvedValue({
      id: 'ce-7b',
      document_id: 'doc-1',
      change_type: 'AMENDMENT',
      amendment_sfs: null,
      ai_summary: null,
      changed_sections: null,
      document: {
        title: 'Testlagen',
        document_number: 'SFS 2020:1',
        effective_date: null,
      },
    } as never)
    const changePrompt = await buildSystemPrompt({
      contextType: 'change',
      contextId: 'ce-7b',
    })
    expect(changePrompt).toContain('get_law_list_item') // enrichment prep step
    expect(changePrompt).toContain('Bedömningsflöde') // parity preserved
    expect(changePrompt).toContain('suggest_followups') // parity preserved
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
    // Story 17.10: bumped from 5500 → 6500. Prior ceiling had already been
    // breached at baseline (~5594) before 17.10's three workspace-document
    // tool entries (+237 tokens after AC-18 terse-trim).
    // feat/ai-agent UAT bump: 6500 → 6750. Baseline grew ~60 tokens with the
    // tightened guardrail rule (system-prompt.md) + the assess_change skill
    // text rewording — both directly address UX leaks surfaced in UAT, so
    // conscious growth not creep. Revisit / shrink if a future story pushes
    // past 6750 without comparable value.
    // Story 19.8 bump: 6750 → 7100. The 6750 ceiling was ALREADY breached at
    // baseline (~6819) by in-flight system-prompt.md guidance growth on this
    // branch before 19.8; 19.8 itself adds one <available_skills> line for the
    // draft_styrdokument skill (~50 tokens, description kept terse). Still a
    // runaway-growth guard — the next breach should trigger the structured-
    // parts / prompt-caching v2 refactor (Story 14.26 note).
    expect(estimatedTokens).toBeLessThan(7100)
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
    expect(result).toContain('### Verksamhetsbeskrivning (från kunden)')
    expect(result).toContain('Tillverkning av industriella komponenter')
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
    expect(result).toContain('### Verksamhetsbeskrivning (från kunden)')
    expect(result).toContain('Konsultverksamhet inom IT')
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

  // Drift guard — when workspace.name disagrees with CompanyProfile.company_name
  // (rename without re-sync; happened in prod 2026-06-02 against Nordviken),
  // the user-facing workspace name MUST win and a warn MUST be logged.
  describe('workspace-name drift guard', () => {
    it('prefers workspace.name when it differs from profile.company_name and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const profile = makeProfile({
        company_name: 'Stale Original AB',
      })
      const result = formatCompanyContext(profile, 'Renamed Current AB')!
      expect(result).toContain('Företag: Renamed Current AB')
      expect(result).not.toContain('Stale Original AB')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[company-context drift]')
      )
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Renamed Current AB')
      )
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Stale Original AB')
      )
      warn.mockRestore()
    })

    it('does not warn when workspace.name matches profile.company_name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const profile = makeProfile({ company_name: 'Same AB' })
      const result = formatCompanyContext(profile, 'Same AB')!
      expect(result).toContain('Företag: Same AB')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('falls back to profile.company_name when workspaceName is undefined (backward compat)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const profile = makeProfile({ company_name: 'Profile Only AB' })
      const result = formatCompanyContext(profile)!
      expect(result).toContain('Företag: Profile Only AB')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('does not warn on whitespace-only differences', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const profile = makeProfile({ company_name: '  Trimmed AB' })
      const result = formatCompanyContext(profile, 'Trimmed AB  ')!
      expect(result).toContain('Företag: Trimmed AB')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })
})

// ---------------------------------------------------------------------------
// Story 7.7: formatEmployeeContext + <employee_context> injection
// ---------------------------------------------------------------------------

function makeEmployee(
  overrides: Partial<EmployeeContextEmployee> = {}
): EmployeeContextEmployee {
  return {
    first_name: 'Anna',
    last_name: 'Svensson',
    employment_form: 'TV',
    employment_date: new Date('2020-03-01T00:00:00Z'),
    personel_type: 'TJM',
    full_time_equivalent: { toNumber: () => 0.75 },
    inactive: false,
    collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    ...overrides,
  }
}

describe('formatEmployeeContext (Story 7.7)', () => {
  it('formats the full allowlist with Swedish labels', () => {
    const result = formatEmployeeContext(makeEmployee())!

    expect(result).toContain('- Namn: Anna Svensson')
    expect(result).toContain('- Anställningsform: Tillsvidareanställning')
    expect(result).toContain('- Anställningsdatum: 2020-03-01')
    expect(result).toContain('- Personaltyp: Tjänsteman')
    expect(result).toContain('- Sysselsättningsgrad: 75 %')
    expect(result).toContain(
      '- Tilldelat kollektivavtal: Teknikavtalet (avtals-ID: agreement-42)'
    )
    expect(result).toContain('- Status: Aktiv')
  })

  it('returns undefined for null (no employee → no block)', () => {
    expect(formatEmployeeContext(null)).toBeUndefined()
  })

  it('renders "Ej ifylld" for missing optional fields + Inaktiv + no agreement', () => {
    const result = formatEmployeeContext(
      makeEmployee({
        employment_form: null,
        employment_date: null,
        personel_type: null,
        full_time_equivalent: null,
        inactive: true,
        collective_agreement: null,
      })
    )!

    expect(result).toContain('- Anställningsform: Ej ifylld')
    expect(result).toContain('- Anställningsdatum: Ej ifylld')
    expect(result).toContain('- Personaltyp: Ej ifylld')
    expect(result).toContain('- Sysselsättningsgrad: Ej ifylld')
    expect(result).toContain('- Tilldelat kollektivavtal: Inget tilldelat')
    expect(result).toContain('- Status: Inaktiv')
  })

  it('accepts a plain number for full_time_equivalent (Decimal-free callers)', () => {
    const result = formatEmployeeContext(
      makeEmployee({ full_time_equivalent: 1 })
    )!
    expect(result).toContain('- Sysselsättningsgrad: 100 %')
  })

  // PII BY CONSTRUCTION (guardrail): the formatter is an allowlist — a wider
  // object carrying personnummer/email/phone/address must never leak a byte.
  it('NEVER emits personnummer/email/phone/address — even from a polluted record', () => {
    const polluted = {
      ...makeEmployee(),
      personnummer: '19850101-1234',
      personnummer_masked: false,
      email: 'anna.svensson@example.com',
      phone1: '070-123 45 67',
      phone2: '08-555 123',
      address1: 'Storgatan 1',
      address2: 'Lgh 1201',
      post_code: '11122',
      city: 'Stockholm',
      fortnox_raw: { PersonalIdentityNumber: '19850101-1234' },
    } as unknown as EmployeeContextEmployee

    const result = formatEmployeeContext(polluted)!

    expect(result).not.toContain('19850101')
    expect(result).not.toContain('19850101-1234')
    expect(result).not.toMatch(/personnummer/i)
    expect(result).not.toContain('@')
    expect(result).not.toContain('070-123')
    expect(result).not.toContain('08-555')
    expect(result).not.toContain('Storgatan')
    expect(result).not.toContain('Lgh 1201')
    expect(result).not.toContain('11122')
    expect(result).not.toContain('Stockholm')
  })
})

describe('buildSystemPrompt — <employee_context> (Story 7.7)', () => {
  it('injects the wrapped block when employeeContext is provided', async () => {
    const employeeContext = formatEmployeeContext(makeEmployee())!
    const prompt = await buildSystemPrompt({ employeeContext })

    expect(prompt).toContain('<employee_context>')
    expect(prompt).toContain('## Anställd i fokus')
    expect(prompt).toContain('- Namn: Anna Svensson')
    expect(prompt).toContain('search_collective_agreements')
    expect(prompt).toContain('</employee_context>')
  })

  it('HOT-PATH INERTNESS: no employeeContext → byte-identical prompt (undefined AND absent)', async () => {
    // The pre-7.7 shape of the call (no employeeContext key at all)...
    const baseline = await buildSystemPrompt({
      companyContext: '- Företag: Test AB',
      contextType: 'global',
    })
    // ...must be byte-identical both when the key is explicitly undefined
    // (what the route passes on the no-employee path)...
    const withUndefined = await buildSystemPrompt({
      companyContext: '- Företag: Test AB',
      contextType: 'global',
      employeeContext: undefined,
    })
    expect(withUndefined).toBe(baseline)
    // ...and must not contain any trace of the employee block.
    expect(baseline).not.toContain('<employee_context>')
    expect(baseline).not.toContain('Anställd i fokus')
  })

  it('block ordering: employee context sits after company context', async () => {
    const prompt = await buildSystemPrompt({
      companyContext: '- Företag: Test AB',
      employeeContext: '- Namn: Anna Svensson',
    })
    const companyIdx = prompt.indexOf('<company_context>')
    const employeeIdx = prompt.indexOf('<employee_context>')
    expect(companyIdx).toBeGreaterThanOrEqual(0)
    expect(employeeIdx).toBeGreaterThan(companyIdx)
  })
})

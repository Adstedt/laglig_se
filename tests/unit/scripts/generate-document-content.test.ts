/**
 * Story 12.3: Unit Tests for Document Content Generation Pipeline
 *
 * Tests cover: schema migration, prompt construction, quality validation,
 * context assembly, HTML stripping, batch orchestration, cost tracking,
 * JSON parsing, and resumable behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

// ============================================================================
// Schema Tests
// ============================================================================

describe('Story 12.3: Schema migration', () => {
  it('LegalDocument has kommentar field', () => {
    expect(Prisma.LegalDocumentScalarFieldEnum.kommentar).toBe('kommentar')
  })

  it('LegalDocument has summering_generated_by field', () => {
    expect(Prisma.LegalDocumentScalarFieldEnum.summering_generated_by).toBe(
      'summering_generated_by'
    )
  })

  it('LegalDocument has kommentar_generated_by field', () => {
    expect(Prisma.LegalDocumentScalarFieldEnum.kommentar_generated_by).toBe(
      'kommentar_generated_by'
    )
  })

  it('LegalDocument still has summary field (repurposed as Summering)', () => {
    expect(Prisma.LegalDocumentScalarFieldEnum.summary).toBe('summary')
  })
})

// ============================================================================
// Prompt Construction Tests
// ============================================================================

describe('Story 12.3: Prompt construction', () => {
  let buildSystemPrompt: typeof import('@/lib/ai/prompts/document-content').buildSystemPrompt

  beforeEach(async () => {
    const mod = await import('@/lib/ai/prompts/document-content')
    buildSystemPrompt = mod.buildSystemPrompt
  })

  it('Summering prompt includes neutral voice instruction', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('neutral')
    expect(prompt).toContain('Tredjeperson')
    expect(prompt).toContain('Summering')
  })

  it('Summering prompt includes few-shot examples from notisumComment', () => {
    const prompt = buildSystemPrompt()
    // Key phrases from the few-shot examples
    expect(prompt).toContain('Arbetsmiljölagen (AML) är en ramlag')
    expect(prompt).toContain('Miljöbalken är en stor miljölag')
  })

  it('Summering prompt includes anti-patterns', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('FÖRBJUDET')
    expect(prompt).toContain('Vi ska')
  })

  it('Kommentar prompt includes "Vi ska..." instruction', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('Vi ska')
    expect(prompt).toContain('Vi behöver')
    expect(prompt).toContain('Vi är skyldiga')
  })

  it('Kommentar prompt includes few-shot examples from summaryText', () => {
    const prompt = buildSystemPrompt()
    // Key phrases from the Kommentar few-shot examples
    expect(prompt).toContain('Vi ska ha en tillfredsställande arbetsmiljö')
    expect(prompt).toContain('Vi ska bestämma ändamålet')
  })

  it('Prompt includes JSON output formatting instruction', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('"summering"')
    expect(prompt).toContain('"kommentar"')
  })

  it('Prompt includes DO/DONT patterns', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('DO')
    expect(prompt).toContain('DON')
    expect(prompt).toContain('aktiv röst')
  })
})

// ============================================================================
// Quality Validation Tests
// ============================================================================

describe('Story 12.3: Quality validation', () => {
  let validateSummering: typeof import('@/scripts/generate-document-content').validateSummering
  let validateKommentar: typeof import('@/scripts/generate-document-content').validateKommentar

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    validateSummering = mod.validateSummering
    validateKommentar = mod.validateKommentar
  })

  it('warns when Summering contains "Vi ska..."', () => {
    const warnings = validateSummering(
      'Vi ska bedriva ett systematiskt arbetsmiljöarbete.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.field).toBe('summering')
    expect(warnings[0]!.message).toContain('obligation language')
  })

  it('warns when Summering contains "Vi behöver..."', () => {
    const warnings = validateSummering(
      'Vi behöver ha en arbetsmiljöpolicy.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.field).toBe('summering')
  })

  it('does not warn for neutral Summering', () => {
    const warnings = validateSummering(
      'Arbetsmiljölagen är en ramlag som reglerar arbetsmiljöarbete.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings).toHaveLength(0)
  })

  it('warns when Summering is empty', () => {
    const warnings = validateSummering('', 'doc-1', 'SFS 1977:1160')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.message).toContain('Empty')
  })

  it('warns when Summering is excessively long', () => {
    const longText = 'A'.repeat(2001)
    const warnings = validateSummering(longText, 'doc-1', 'SFS 1977:1160')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.message).toContain('unusually long')
  })

  it('warns when Kommentar does not start with obligation phrasing', () => {
    const warnings = validateKommentar(
      'Denna lag reglerar arbetsmiljö.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.field).toBe('kommentar')
    expect(warnings[0]!.message).toContain('obligation-focused')
  })

  it('does not warn when Kommentar starts with "Vi ska..."', () => {
    const warnings = validateKommentar(
      'Vi ska bedriva ett systematiskt arbetsmiljöarbete.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings).toHaveLength(0)
  })

  it('does not warn when Kommentar starts with "Vi behöver..."', () => {
    const warnings = validateKommentar(
      'Vi behöver ha en arbetsmiljöpolicy.',
      'doc-1',
      'SFS 1977:1160'
    )
    expect(warnings).toHaveLength(0)
  })

  it('does not warn when Kommentar starts with "Om vi..."', () => {
    const warnings = validateKommentar(
      'Om vi bedriver tillståndspliktig verksamhet ska vi utreda risker.',
      'doc-1',
      'SFS 2010:1011'
    )
    expect(warnings).toHaveLength(0)
  })

  it('warns when Kommentar is empty', () => {
    const warnings = validateKommentar('', 'doc-1', 'SFS 1977:1160')
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Context Assembly Tests
// ============================================================================

describe('Story 12.3: Context assembly', () => {
  let buildDocumentContext: typeof import('@/lib/ai/prompts/document-content').buildDocumentContext
  let getSourceText: typeof import('@/lib/ai/prompts/document-content').getSourceText
  let stripHtml: typeof import('@/lib/ai/prompts/document-content').stripHtml

  beforeEach(async () => {
    const mod = await import('@/lib/ai/prompts/document-content')
    buildDocumentContext = mod.buildDocumentContext
    getSourceText = mod.getSourceText
    stripHtml = mod.stripHtml
  })

  it('includes document text and amendments in context', () => {
    const context = buildDocumentContext({
      document_number: 'SFS 1977:1160',
      title: 'Arbetsmiljölag (1977:1160)',
      content_type: 'SFS_LAW',
      effective_date: '1978-07-01',
      publication_date: '1977-12-19',
      status: 'ACTIVE',
      source_text: 'Full text of the law...',
      metadata: null,
      amendments: [
        {
          amending_law_title: 'Lag (2025:732) om ändring i arbetsmiljölagen',
          effective_date: '2025-07-01',
          affected_sections_raw: 'ändr. 6 kap. 17 §',
          summary: 'Updated workplace safety provisions',
        },
      ],
    })

    expect(context).toContain('SFS 1977:1160')
    expect(context).toContain('Arbetsmiljölag (1977:1160)')
    expect(context).toContain('Full text of the law...')
    expect(context).toContain('Lag (2025:732)')
    expect(context).toContain('ändr. 6 kap. 17 §')
    expect(context).toContain('Ändringshistorik')
  })

  it('includes "ersätter" mapping from metadata', () => {
    const context = buildDocumentContext({
      document_number: 'AFS 2023:1',
      title: 'Systematiskt arbetsmiljöarbete',
      content_type: 'AGENCY_REGULATION',
      effective_date: '2025-01-01',
      publication_date: null,
      status: 'ACTIVE',
      source_text: 'Full text...',
      metadata: { replacesOldReference: 'AFS 2001:1' },
      amendments: [],
    })

    expect(context).toContain('Ersätter: AFS 2001:1')
  })

  it('HTML stripping produces clean text', () => {
    const html =
      '<h1>Arbetsmiljölag</h1><p>Denna lag &amp; förordning gäller&nbsp;alla.</p>'
    const text = stripHtml(html)
    expect(text).toBe('Arbetsmiljölag Denna lag & förordning gäller alla.')
    expect(text).not.toContain('<')
    expect(text).not.toContain('&amp;')
    expect(text).not.toContain('&nbsp;')
  })

  it('HTML stripping handles Swedish entities', () => {
    const html = '<p>&auml; &ouml; &aring; &Auml; &Ouml; &Aring;</p>'
    const text = stripHtml(html)
    expect(text).toBe('ä ö å Ä Ö Å')
  })

  it('getSourceText returns html_content first (stripped)', () => {
    const text = getSourceText({
      html_content: '<p>HTML content</p>',
      markdown_content: 'Markdown content',
      full_text: 'Full text',
    })
    expect(text).toBe('HTML content')
  })

  it('getSourceText falls back to markdown_content', () => {
    const text = getSourceText({
      html_content: null,
      markdown_content: 'Markdown content',
      full_text: 'Full text',
    })
    expect(text).toBe('Markdown content')
  })

  it('getSourceText falls back to full_text', () => {
    const text = getSourceText({
      html_content: null,
      markdown_content: null,
      full_text: 'Full text',
    })
    expect(text).toBe('Full text')
  })

  it('getSourceText returns null when all fields are null', () => {
    const text = getSourceText({
      html_content: null,
      markdown_content: null,
      full_text: null,
    })
    expect(text).toBeNull()
  })
})

// ============================================================================
// CLI Args Parsing Tests
// ============================================================================

describe('Story 12.3: CLI args parsing', () => {
  let parseArgs: typeof import('@/scripts/generate-document-content').parseArgs

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    parseArgs = mod.parseArgs
  })

  it('defaults to template-docs scope', () => {
    const config = parseArgs([])
    expect(config.scope).toBe('template-docs')
  })

  it('parses --scope all', () => {
    const config = parseArgs(['--scope', 'all'])
    expect(config.scope).toBe('all')
  })

  it('parses --force flag', () => {
    const config = parseArgs(['--force'])
    expect(config.force).toBe(true)
  })

  it('parses --limit', () => {
    const config = parseArgs(['--limit', '10'])
    expect(config.limit).toBe(10)
  })

  it('parses --batch-id for resume', () => {
    const config = parseArgs(['--batch-id', 'msgbatch_abc123'])
    expect(config.batchId).toBe('msgbatch_abc123')
  })

  it('--batch-id skips Phase 1 (batchId is set)', () => {
    const config = parseArgs(['--batch-id', 'msgbatch_abc123'])
    expect(config.batchId).not.toBeNull()
  })

  it('parses --dry-run flag', () => {
    const config = parseArgs(['--dry-run'])
    expect(config.dryRun).toBe(true)
  })

  it('default config has force=false, limit=0, batchId=null, dryRun=false', () => {
    const config = parseArgs([])
    expect(config.force).toBe(false)
    expect(config.limit).toBe(0)
    expect(config.batchId).toBeNull()
    expect(config.dryRun).toBe(false)
  })
})

// ============================================================================
// JSON Response Parsing Tests
// ============================================================================

describe('Story 12.3: stripMarkdownCodeBlock helper', () => {
  let stripMarkdownCodeBlock: typeof import('@/scripts/generate-document-content').stripMarkdownCodeBlock

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    stripMarkdownCodeBlock = mod.stripMarkdownCodeBlock
  })

  it('strips ```json fences', () => {
    const result = stripMarkdownCodeBlock('```json\n{"key": "val"}\n```')
    expect(result).toBe('{"key": "val"}')
  })

  it('strips plain ``` fences', () => {
    const result = stripMarkdownCodeBlock('```\n{"key": "val"}\n```')
    expect(result).toBe('{"key": "val"}')
  })

  it('returns plain text unchanged', () => {
    const result = stripMarkdownCodeBlock('{"key": "val"}')
    expect(result).toBe('{"key": "val"}')
  })

  it('trims whitespace', () => {
    const result = stripMarkdownCodeBlock('  {"key": "val"}  ')
    expect(result).toBe('{"key": "val"}')
  })
})

describe('Story 12.3: JSON response parsing', () => {
  let parseGeneratedContent: typeof import('@/scripts/generate-document-content').parseGeneratedContent

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    parseGeneratedContent = mod.parseGeneratedContent
  })

  it('parses valid JSON response', () => {
    const result = parseGeneratedContent(
      '{"summering": "Lagen reglerar...", "kommentar": "Vi ska..."}'
    )
    expect(result).not.toBeNull()
    expect(result!.summering).toBe('Lagen reglerar...')
    expect(result!.kommentar).toBe('Vi ska...')
  })

  it('handles JSON wrapped in markdown code blocks', () => {
    const result = parseGeneratedContent(
      '```json\n{"summering": "Test", "kommentar": "Test"}\n```'
    )
    expect(result).not.toBeNull()
    expect(result!.summering).toBe('Test')
  })

  it('returns null for malformed JSON', () => {
    const result = parseGeneratedContent('not json at all')
    expect(result).toBeNull()
  })

  it('returns null when summering is missing', () => {
    const result = parseGeneratedContent('{"kommentar": "Vi ska..."}')
    expect(result).toBeNull()
  })

  it('returns null when kommentar is missing', () => {
    const result = parseGeneratedContent('{"summering": "Lagen..."}')
    expect(result).toBeNull()
  })

  it('returns null when fields are not strings', () => {
    const result = parseGeneratedContent(
      '{"summering": 123, "kommentar": null}'
    )
    expect(result).toBeNull()
  })
})

// ============================================================================
// Batch Request Building Tests
// ============================================================================

describe('Story 12.3: Batch request building', () => {
  let buildBatchRequests: typeof import('@/scripts/generate-document-content').buildBatchRequests

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    buildBatchRequests = mod.buildBatchRequests
  })

  it('builds correct request array with custom_id mapping', () => {
    const documents = [
      {
        id: 'doc-uuid-1',
        document_number: 'SFS 1977:1160',
        title: 'Arbetsmiljölag',
        content_type: 'SFS_LAW' as const,
        effective_date: new Date('1978-07-01'),
        publication_date: null,
        status: 'ACTIVE' as const,
        html_content: '<p>Full text</p>',
        markdown_content: null,
        full_text: null,
        metadata: null,
        base_amendments: [],
      },
    ] as never[]

    const { requests, skippedNoSource } = buildBatchRequests(
      documents,
      'system prompt'
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]!.custom_id).toBe('doc-uuid-1')
    expect(requests[0]!.params.model).toBe('claude-opus-4-6')
    expect(requests[0]!.params.max_tokens).toBe(2048)
    expect(requests[0]!.params.system).toBe('system prompt')
    expect(requests[0]!.params.messages[0]!.role).toBe('user')
    expect(requests[0]!.params.messages[0]!.content).toContain('SFS 1977:1160')
    expect(skippedNoSource).toHaveLength(0)
  })

  it('skips documents with no source text and logs warning', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const documents = [
      {
        id: 'doc-uuid-2',
        document_number: 'SFS 2020:123',
        title: 'Empty law',
        content_type: 'SFS_LAW' as const,
        effective_date: null,
        publication_date: null,
        status: 'ACTIVE' as const,
        html_content: null,
        markdown_content: null,
        full_text: null,
        metadata: null,
        base_amendments: [],
      },
    ] as never[]

    const { requests, skippedNoSource } = buildBatchRequests(
      documents,
      'system prompt'
    )

    expect(requests).toHaveLength(0)
    expect(skippedNoSource).toHaveLength(1)
    expect(skippedNoSource[0]).toBe('SFS 2020:123')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('SFS 2020:123')
    )

    consoleSpy.mockRestore()
  })
})

// ============================================================================
// Cost Tracking Tests
// ============================================================================

describe('Story 12.3: Cost tracking', () => {
  let createCostTracker: typeof import('@/scripts/generate-document-content').createCostTracker
  let addGenerationTokens: typeof import('@/scripts/generate-document-content').addGenerationTokens
  let addValidationTokens: typeof import('@/scripts/generate-document-content').addValidationTokens
  let calculateCost: typeof import('@/scripts/generate-document-content').calculateCost

  beforeEach(async () => {
    const mod = await import('@/scripts/generate-document-content')
    createCostTracker = mod.createCostTracker
    addGenerationTokens = mod.addGenerationTokens
    addValidationTokens = mod.addValidationTokens
    calculateCost = mod.calculateCost
  })

  it('accumulates generation tokens correctly', () => {
    const tracker = createCostTracker()
    addGenerationTokens(tracker, 500, 200)
    addGenerationTokens(tracker, 300, 100)
    expect(tracker.generation.inputTokens).toBe(800)
    expect(tracker.generation.outputTokens).toBe(300)
  })

  it('accumulates validation tokens separately', () => {
    const tracker = createCostTracker()
    addGenerationTokens(tracker, 1000, 500)
    addValidationTokens(tracker, 200, 50)
    expect(tracker.generation.inputTokens).toBe(1000)
    expect(tracker.validation.inputTokens).toBe(200)
  })

  it('calculates cost with Batch API pricing', () => {
    const tracker = createCostTracker()
    addGenerationTokens(tracker, 1_000_000, 100_000)
    addValidationTokens(tracker, 500_000, 50_000)

    const costs = calculateCost(tracker)

    // Generation: 1M * $7.50/MTok + 100K * $37.50/MTok = $7.50 + $3.75 = $11.25
    expect(costs.generationCost).toBeCloseTo(11.25, 2)

    // Validation: 500K * $0.40/MTok + 50K * $2.00/MTok = $0.20 + $0.10 = $0.30
    expect(costs.validationCost).toBeCloseTo(0.3, 2)

    // Total: $11.55
    expect(costs.totalCost).toBeCloseTo(11.55, 2)
  })

  it('starts at zero', () => {
    const tracker = createCostTracker()
    const costs = calculateCost(tracker)
    expect(costs.totalCost).toBe(0)
    expect(costs.generationCost).toBe(0)
    expect(costs.validationCost).toBe(0)
  })
})

// ============================================================================
// Hallucination Check Tests
// ============================================================================

describe('Story 12.3: Hallucination check', () => {
  let buildHallucinationCheckPrompt: typeof import('@/lib/ai/prompts/document-content').buildHallucinationCheckPrompt
  let buildHallucinationCheckUserMessage: typeof import('@/lib/ai/prompts/document-content').buildHallucinationCheckUserMessage

  beforeEach(async () => {
    const mod = await import('@/lib/ai/prompts/document-content')
    buildHallucinationCheckPrompt = mod.buildHallucinationCheckPrompt
    buildHallucinationCheckUserMessage = mod.buildHallucinationCheckUserMessage
  })

  it('hallucination check prompt asks about unsupported claims', () => {
    const prompt = buildHallucinationCheckPrompt()
    expect(prompt).toContain('stöds av källtexten')
    expect(prompt).toContain('has_unsupported_claims')
    expect(prompt).toContain('JSON')
  })

  it('hallucination check user message includes generated output + source text', () => {
    const message = buildHallucinationCheckUserMessage(
      'Generated summering text',
      'Generated kommentar text',
      'Source document text'
    )
    expect(message).toContain('Generated summering text')
    expect(message).toContain('Generated kommentar text')
    expect(message).toContain('Source document text')
    expect(message).toContain('Summering')
    expect(message).toContain('Kommentar')
    expect(message).toContain('Källtext')
  })
})

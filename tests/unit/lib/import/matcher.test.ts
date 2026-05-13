/**
 * Story 24.3 AC 19: matcher unit tests with mocked Anthropic + mocked
 * findMatchCandidates. Tests Stage-1 short-circuits, tier mapping, parse-
 * failure retry, and open-set agency support via parseDocumentNumber.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// matcher.ts:getAnthropicClient reads process.env.ANTHROPIC_API_KEY and
// throws when unset BEFORE the SDK constructor runs — so the vi.mock below
// never gets a chance to intercept on a clean CI env. Stub a dummy value so
// the env-check passes; the MockAnthropic constructor (vi.mock'd below)
// ignores the value entirely.
beforeAll(() => {
  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = 'test-mock-key'
  }
})

// Mock findMatchCandidates so we can drive matchRow without a real DB.
vi.mock('@/lib/search/match-candidates', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/search/match-candidates')
  >('@/lib/search/match-candidates')
  return {
    ...actual,
    findMatchCandidates: vi.fn(),
  }
})

// Mock Anthropic SDK so we never make network calls in unit tests.
const mockMessagesCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockMessagesCreate }
      static APIError = class extends Error {
        status: number
        constructor(msg: string, status = 500) {
          super(msg)
          this.status = status
        }
      }
    },
  }
})

import { matchRow, __test__ } from '@/lib/import/matcher'
import { findMatchCandidates } from '@/lib/search/match-candidates'

const mockFindCandidates = vi.mocked(findMatchCandidates)

function llmTextResponse(json: object) {
  return {
    content: [{ type: 'text', text: JSON.stringify(json) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('matchRow — Stage 1 short-circuits', () => {
  it('short-circuits when zero candidates returned', async () => {
    mockFindCandidates.mockResolvedValue([])

    const result = await matchRow({
      titel: 'Some unfindable law',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(result.confidence_tier).toBe('unmatched')
    expect(result.matched_document_id).toBeNull()
    expect(result.reasoning).toBe('Inga kandidater i katalogen')
    expect(result.llm_used).toBe(false)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('short-circuits on document_number_exact + score >= 0.95 (SFS)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-sfs',
        title: 'Arbetsmiljölag',
        document_number: 'SFS 1977:1160',
        content_type: 'SFS_LAW',
        fuzzy_score: 1.0,
        match_signals: {
          document_number_exact: true,
          document_number_suffix_match: false,
          title_trigram_score: 0,
          has_amendment_match: false,
        },
      },
    ])

    const result = await matchRow({
      titel: 'Arbetsmiljölag',
      sfs_nummer: 'SFS 1977:1160',
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-sfs')
    expect(result.confidence_score).toBe(1.0)
    expect(result.confidence_tier).toBe('high')
    expect(result.llm_used).toBe(false)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('short-circuits on document_number_exact for AFS (proves non-SFS path)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-afs',
        title: 'Föreskrifter om systematiskt arbetsmiljöarbete',
        document_number: 'AFS 2001:1',
        content_type: 'AGENCY_REGULATION',
        fuzzy_score: 1.0,
        match_signals: {
          document_number_exact: true,
          document_number_suffix_match: false,
          title_trigram_score: 0,
          has_amendment_match: false,
        },
      },
    ])

    const result = await matchRow({
      titel: 'AFS 2001:1',
      sfs_nummer: 'AFS 2001:1',
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-afs')
    expect(result.confidence_tier).toBe('high')
    expect(result.llm_used).toBe(false)
  })

  it('short-circuits on document_number_exact for EU (proves EU path)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-eu',
        title: 'GDPR',
        document_number: 'Regulation (EU) 2016/679',
        content_type: 'EU_REGULATION',
        fuzzy_score: 1.0,
        match_signals: {
          document_number_exact: true,
          document_number_suffix_match: false,
          title_trigram_score: 0,
          has_amendment_match: false,
        },
      },
    ])

    const result = await matchRow({
      titel: 'GDPR',
      sfs_nummer: '(EU) 2016/679',
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-eu')
    expect(result.confidence_tier).toBe('high')
    expect(result.llm_used).toBe(false)
  })
})

describe('matchRow — Stage 2 LLM path', () => {
  it('calls LLM when 1+ candidates have fuzzy_score < 0.95', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'Some law',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.7,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.7,
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: 'doc-1',
        confidence: 0.9,
        reasoning: 'Titel matchar nära',
      })
    )

    const result = await matchRow({
      titel: 'Some law',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(mockMessagesCreate).toHaveBeenCalledOnce()
    expect(result.matched_document_id).toBe('doc-1')
    expect(result.confidence_tier).toBe('high')
    expect(result.llm_used).toBe(true)
    expect(result.reasoning).toBe('Titel matchar nära')
  })

  it('handles LLM returning null id (unmatched)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'Maybe',
        document_number: null,
        content_type: 'SFS_LAW',
        fuzzy_score: 0.4,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.4,
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: null,
        confidence: 0.2,
        reasoning: 'För otydlig källrad',
      })
    )

    const result = await matchRow({
      titel: 'X',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBeNull()
    expect(result.confidence_tier).toBe('unmatched')
    expect(result.llm_used).toBe(true)
  })

  it('retries once on parse failure then surfaces as unmatched', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'A',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.6,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    // Both attempts return malformed text
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const result = await matchRow({
      titel: 'A',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2) // initial + 1 retry
    expect(result.matched_document_id).toBeNull()
    expect(result.confidence_tier).toBe('unmatched')
    expect(result.reasoning).toBe('Kunde inte avgöra matchning automatiskt')
  })

  it('rejects LLM hallucination — chosen_document_id not in candidates', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-real',
        title: 'A',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.6,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    // LLM hallucinates a non-existent doc_id on both attempts
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: 'doc-hallucinated',
        confidence: 0.95,
        reasoning: 'I made this up',
      })
    )

    const result = await matchRow({
      titel: 'A',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    // Hallucination gate trips → retried → still hallucinates → unmatched fallback
    expect(result.matched_document_id).toBeNull()
    expect(result.confidence_tier).toBe('unmatched')
  })

  it('forces tier=unmatched when LLM returns null doc_id with confidence >= 0.5 (TEST-003 guard)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'A',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.6,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    // LLM violates the system-prompt instruction: returns null doc_id BUT
    // high confidence. The defensive guard should override this and force
    // tier=unmatched.
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: null,
        confidence: 0.95,
        reasoning: 'High confidence but no match',
      })
    )

    const result = await matchRow({
      titel: 'A',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBeNull()
    expect(result.confidence_tier).toBe('unmatched')
    expect(result.confidence_score).toBe(0)
    expect(result.llm_used).toBe(true)
    expect(result.reasoning).toBe('High confidence but no match')
  })

  it('caps matcher confidence at MEDIUM when LLM picks a Branch-B-only candidate with weak title match (DESIGN-001)', async () => {
    // Setup: candidate has document_number_suffix_match=true but exact=false
    // — i.e. ambiguous-prefix input like "2020:5" landed on a candidate
    // by year+number tail alone, AND the title trigram is weak (the user
    // didn't supply a confirming title). LLM returns high confidence (0.95).
    // Expected: matcher caps surfaced score below HIGH threshold so the
    // user sees a MEDIUM (review-required) match instead of auto-accept.
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-suffix',
        title: 'Något (AFS 2020:5)',
        document_number: 'AFS 2020:5',
        content_type: 'AGENCY_REGULATION',
        fuzzy_score: 0.84, // already capped at the candidates layer
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: true,
          title_trigram_score: 0.2, // weak — title isn't pinning down the series
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: 'doc-suffix',
        confidence: 0.95, // LLM's own confidence — would normally tier=high
        reasoning: 'Sifferdelen matchar',
      })
    )

    const result = await matchRow({
      titel: '2020:5',
      sfs_nummer: '2020:5', // bare — no prefix
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-suffix')
    // Capped just below HIGH threshold
    expect(result.confidence_score).toBeLessThan(0.85)
    expect(result.confidence_tier).toBe('medium')
    expect(result.llm_used).toBe(true)
    expect(result.reasoning).toBe('Sifferdelen matchar')
  })

  it('does NOT cap a Branch-B-only candidate when title trigram is strong (title-rescue override)', async () => {
    // Same Branch-B-only setup as above — but the title trigram is now
    // ≥ 0.5, so the user's bare doc number is no longer genuinely ambiguous
    // (e.g. "Arbetsmiljölag" + "1977:1160" against catalog title
    // "Arbetsmiljölag (1977:1160)"). Title-rescue override skips the cap so
    // the row lands HIGH instead of forcing manual review.
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-suffix-titled',
        title: 'Arbetsmiljölag (1977:1160)',
        document_number: 'SFS 1977:1160',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.84,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: true,
          title_trigram_score: 0.95, // strong — title confirms the choice
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: 'doc-suffix-titled',
        confidence: 0.95,
        reasoning: 'Exakt matchning av både titel och dokumentnummer',
      })
    )

    const result = await matchRow({
      titel: 'Arbetsmiljölag',
      sfs_nummer: '1977:1160',
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-suffix-titled')
    expect(result.confidence_score).toBe(0.95)
    expect(result.confidence_tier).toBe('high')
  })

  it('does NOT cap when chosen candidate matched by Branch A (exact canonical) — full HIGH preserved', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-exact',
        title: 'Arbetsmiljölag',
        document_number: 'SFS 1977:1160',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.9, // sub-0.95 so we still take Stage 2
        match_signals: {
          document_number_exact: true, // <-- the key difference
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: 'doc-exact',
        confidence: 0.95,
        reasoning: 'Exakt match',
      })
    )

    const result = await matchRow({
      titel: 'Arbetsmiljölag',
      sfs_nummer: 'SFS 1977:1160',
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-exact')
    expect(result.confidence_score).toBe(0.95) // un-capped
    expect(result.confidence_tier).toBe('high')
  })

  it('also forces unmatched for null doc_id at medium confidence (≥0.5)', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'A',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.6,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue(
      llmTextResponse({
        chosen_document_id: null,
        confidence: 0.6, // medium tier in the normal mapping
        reasoning: 'Possibly matches but unsure',
      })
    )

    const result = await matchRow({
      titel: 'A',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(result.confidence_tier).toBe('unmatched')
    expect(result.matched_document_id).toBeNull()
  })

  it('extracts JSON from fenced ```json block', async () => {
    mockFindCandidates.mockResolvedValue([
      {
        document_id: 'doc-1',
        title: 'A',
        document_number: 'SFS 2020:1',
        content_type: 'SFS_LAW',
        fuzzy_score: 0.6,
        match_signals: {
          document_number_exact: false,
          document_number_suffix_match: false,
          title_trigram_score: 0.6,
          has_amendment_match: false,
        },
      },
    ])
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Here is my answer:\n```json\n{"chosen_document_id":"doc-1","confidence":0.8,"reasoning":"Match"}\n```',
        },
      ],
      usage: { input_tokens: 20, output_tokens: 30 },
    })

    const result = await matchRow({
      titel: 'A',
      sfs_nummer: null,
      omrade: null,
      kommentar: null,
    })

    expect(result.matched_document_id).toBe('doc-1')
    expect(result.confidence_score).toBe(0.8)
  })
})

describe('tierFromScore', () => {
  it('maps >= 0.85 → high', () => {
    expect(__test__.tierFromScore(0.85)).toBe('high')
    expect(__test__.tierFromScore(1.0)).toBe('high')
  })
  it('maps 0.5..0.85 → medium', () => {
    expect(__test__.tierFromScore(0.5)).toBe('medium')
    expect(__test__.tierFromScore(0.84)).toBe('medium')
  })
  it('maps < 0.5 → unmatched', () => {
    expect(__test__.tierFromScore(0.49)).toBe('unmatched')
    expect(__test__.tierFromScore(0)).toBe('unmatched')
  })
})

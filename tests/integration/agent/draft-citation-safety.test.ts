/**
 * Story 17.10b — Task 8: Adversarial integration tests for the draft-citation
 * safety contract.
 *
 * Scope (as locked by PO 2026-06-02 in AC-23):
 * - Exercises the real `lib/ai/citations.ts` extractor + the real
 *   `lib/ai/rehype-citation-pills.ts` plugin + the real `lib/agent/system-prompt.md`.
 * - SIMULATES the LLM's response text — we don't call a real LLM in CI.
 *   Behavioral compliance with the system-prompt directive ("agent uses
 *   [Utkast:] for DRAFT hits") is verified by the live smoke in Task 9
 *   against Nordviken. These tests pin the PIPELINE'S handling of well-formed
 *   and adversarial LLM outputs.
 *
 * What this catches that the unit tests don't:
 * - End-to-end shape of "tool result → source map → resolvable citation chip"
 *   for both Källa and Utkast forms with realistic chunk-metadata shapes.
 * - The DRAFT-only + leading-question class of inputs ("vad är vår officiella
 *   policy?") — the pipeline doesn't synthesize a [Källa:] source-map key for
 *   a DRAFT chunk, which is the structural guard against the LLM-as-attacker
 *   case.
 *
 * What this does NOT catch (Task 9's job):
 * - Whether the LLM actually obeys the system-prompt directive when the tool
 *   result has status: 'DRAFT'. Live LLM call required.
 */

import { describe, it, expect } from 'vitest'
import type { Root, Text, Element } from 'hast'
import {
  extractSourcesFromToolResult,
  resolveSource,
  hasCitationMarkers,
  sourcesToMap,
} from '@/lib/ai/citations'
import { rehypeCitationPills } from '@/lib/ai/rehype-citation-pills'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'

// ---------------------------------------------------------------------------
// Test harness: apply rehypeCitationPills to a single-paragraph hast tree.
// Mirrors the pattern from tests/unit/lib/ai/rehype-citation-pills.test.ts.
// ---------------------------------------------------------------------------

function buildTree(text: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: text }],
      },
    ],
  }
}

function getParagraphChildren(tree: Root): (Text | Element)[] {
  const p = tree.children[0] as Element
  return p.children as (Text | Element)[]
}

function findCites(tree: Root): Element[] {
  return getParagraphChildren(tree).filter(
    (c) => c.type === 'element' && c.tagName === 'cite'
  ) as Element[]
}

function tierOf(cite: Element): string | undefined {
  return (cite.properties as { 'data-tier'?: string })?.['data-tier']
}

function chipTextOf(cite: Element): string {
  return (cite.children[0] as Text).value
}

const plugin = rehypeCitationPills()

// Build a search_workspace_documents tool-result envelope from a list of
// chunk-metadata-style fixtures.
function makeSearchResult(
  items: Array<{
    documentId: string
    title: string
    status: 'APPROVED' | 'DRAFT' | 'IN_REVIEW'
    snippet?: string
  }>
) {
  return {
    data: items.map((i) => ({
      documentId: i.documentId,
      title: i.title,
      documentType: 'POLICY',
      status: i.status,
      versionNumber: 1,
      snippet: i.snippet ?? `excerpt of ${i.title}`,
      relevanceScore: 0.9,
      // DEC-2: citationKey is the bare title (agent picks bracket form by status).
      citationKey: i.title,
    })),
  }
}

// ---------------------------------------------------------------------------
// Seed 1: DRAFT-only workspace
// ---------------------------------------------------------------------------

describe('17.10b Seed 1 — DRAFT-only workspace', () => {
  const toolResult = makeSearchResult([
    {
      documentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Semesterpolicy',
      status: 'DRAFT',
      snippet:
        'Anställda har rätt till 25 dagars semester per kalenderår enligt utkastet.',
    },
  ])
  const sources = extractSourcesFromToolResult(
    'search_workspace_documents',
    toolResult
  )
  const sourceMap = sourcesToMap(sources)

  it('source map contains the bare title key (no [Källa:] / [Utkast:] keys baked in)', () => {
    expect(sources['Semesterpolicy']).toBeDefined()
    // Crucially: no pre-formatted bracketed key. The bracket form is the
    // agent's runtime choice; the source map stays neutral.
    expect(sources['[Källa: Semesterpolicy]']).toBeUndefined()
    expect(sources['[Utkast: Semesterpolicy]']).toBeUndefined()
  })

  it('well-formed agent response with [Utkast:] + hedge renders an Utkast pill', () => {
    const llmText =
      'Enligt utkast till Semesterpolicyn föreslås 25 semesterdagar för anställda. Detta är ännu inte godkänt[Utkast: Semesterpolicy].'

    expect(hasCitationMarkers(llmText)).toBe(true)

    const tree = buildTree(llmText)
    plugin(tree)

    const cites = findCites(tree)
    expect(cites).toHaveLength(1)
    expect(tierOf(cites[0]!)).toBe('draft')
    expect(chipTextOf(cites[0]!)).toBe('Utkast: Semesterpolicy')

    // The hedge phrases stay in the rendered paragraph text — outside the chip.
    const paragraphText = getParagraphChildren(tree)
      .map((c) => (c.type === 'text' ? c.value : ''))
      .join('')
    expect(paragraphText).toContain('Enligt utkast till')
    expect(paragraphText).toContain('ännu inte godkänt')
  })

  it('resolveSource resolves the Utkast chip back to the underlying source', () => {
    // The chip's children text after rehype = "Utkast: Semesterpolicy". The
    // resolver MUST strip the "Utkast: " prefix to hit the title-keyed map.
    const resolved = resolveSource('Utkast: Semesterpolicy', sourceMap)
    expect(resolved?.documentNumber).toBe('Semesterpolicy')
  })

  it('pipeline does NOT synthesize a [Källa:] key for the DRAFT chunk (structural safety)', () => {
    // The source map has only the bare title — no tier-prefixed entry. This
    // is the structural boundary: the pipeline never CREATES a Källa-tier
    // entry; the bracket form is the LLM's emit. What the system enforces vs
    // what the system prompt has to teach.
    expect(Object.keys(sources)).toEqual(['Semesterpolicy'])
  })
})

// ---------------------------------------------------------------------------
// Seed 2: Mixed canonical + draft on the same topic
// ---------------------------------------------------------------------------

describe('17.10b Seed 2 — Mixed APPROVED + DRAFT on the same topic', () => {
  const toolResult = makeSearchResult([
    {
      documentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Diskrimineringspolicy',
      status: 'APPROVED',
      snippet: 'Förbjudet att diskriminera på grund av kön eller ålder.',
    },
    {
      documentId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      title: 'Diskrimineringspolicy — Revision',
      status: 'DRAFT',
      snippet: 'Utkast lägger till intersektionalitetsperspektiv.',
    },
  ])
  const sources = extractSourcesFromToolResult(
    'search_workspace_documents',
    toolResult
  )

  it('both items have bare-title source-map keys (no tier in keys)', () => {
    expect(sources['Diskrimineringspolicy']).toBeDefined()
    expect(sources['Diskrimineringspolicy — Revision']).toBeDefined()
  })

  it('mixed-tier response renders one canonical + one draft pill', () => {
    const llmText =
      'Er gällande Diskrimineringspolicy förbjuder diskriminering på grund av kön och ålder[Källa: Diskrimineringspolicy]. Ett pågående utkast föreslår att också inkludera intersektionalitetsperspektivet, men det är ännu inte godkänt[Utkast: Diskrimineringspolicy — Revision].'

    const tree = buildTree(llmText)
    plugin(tree)

    const cites = findCites(tree)
    expect(cites).toHaveLength(2)
    expect(tierOf(cites[0]!)).toBe('canonical')
    expect(chipTextOf(cites[0]!)).toBe('Diskrimineringspolicy')
    expect(tierOf(cites[1]!)).toBe('draft')
    expect(chipTextOf(cites[1]!)).toBe(
      'Utkast: Diskrimineringspolicy — Revision'
    )

    // The hedging language stays visible outside the chips.
    const paragraphText = getParagraphChildren(tree)
      .map((c) => (c.type === 'text' ? c.value : ''))
      .join('')
    expect(paragraphText).toContain('Ett pågående utkast föreslår')
    expect(paragraphText).toContain('ännu inte godkänt')
  })

  it('CITE-002 collision: distinct titles (one with " — Revision" suffix) do NOT collide', () => {
    // Different titles → no id-suffix on either key.
    expect(sources['Diskrimineringspolicy (bbbbbbbb)']).toBeUndefined()
    expect(
      sources['Diskrimineringspolicy — Revision (cccccccc)']
    ).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Seed 3: ADVERSARIAL — "vad är vår officiella policy?" against DRAFT-only
// ---------------------------------------------------------------------------

describe('17.10b Seed 3 — adversarial leading question against DRAFT-only', () => {
  // The user asks for "official policy" but the workspace only has DRAFTs.
  // This is the highest-risk LLM-behavioral case (the live-smoke probe in
  // Task 9). At the pipeline level we pin: even if the LLM erroneously
  // produced a [Källa:] for a DRAFT chunk, the pipeline doesn't synthesize a
  // canonical-tier source-map entry — the DRAFT's source map is unchanged.

  const toolResult = makeSearchResult([
    {
      documentId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      title: 'Arbetsmiljöpolicy',
      status: 'DRAFT',
      snippet: 'Riskbedömningar görs årligen.',
    },
  ])
  const sources = extractSourcesFromToolResult(
    'search_workspace_documents',
    toolResult
  )

  it('source map has exactly ONE entry — no synthesized canonical-form key', () => {
    expect(Object.keys(sources)).toEqual(['Arbetsmiljöpolicy'])
  })

  it('system prompt teaches the agent to refuse the leading-question framing', async () => {
    // The prompt-layer half of the safety contract. The behavioral half
    // (does the LLM actually refuse?) is Task 9's live smoke.
    const prompt = await buildSystemPrompt()
    expect(prompt).toContain(
      'Citera DRAFT/IN_REVIEW-träffar som `[Utkast: <titel>]`'
    )
    expect(prompt).toContain('enligt utkast till')
    expect(prompt).toContain(
      'ALDRIG "enligt …" eller "vår policy säger …" som om utkastet vore gällande policy'
    )
  })

  it('CORRECT agent response (refuse-then-hedge) renders cleanly through the pipeline', () => {
    const correctLlmText =
      'Ni har för närvarande ingen godkänd Arbetsmiljöpolicy — bara ett utkast. Enligt utkastet görs riskbedömningar årligen, men det här är inte officiell policy ännu[Utkast: Arbetsmiljöpolicy].'

    const tree = buildTree(correctLlmText)
    plugin(tree)

    const cites = findCites(tree)
    expect(cites).toHaveLength(1)
    expect(tierOf(cites[0]!)).toBe('draft')
    expect(chipTextOf(cites[0]!)).toBe('Utkast: Arbetsmiljöpolicy')

    const paragraphText = getParagraphChildren(tree)
      .map((c) => (c.type === 'text' ? c.value : ''))
      .join('')
    expect(paragraphText).toContain('ingen godkänd Arbetsmiljöpolicy')
    expect(paragraphText).toContain('inte officiell policy ännu')
  })

  it('REGRESSION marker: if the LLM erroneously emits [Källa:] for a DRAFT, the chip renders as canonical', () => {
    // This is the LIVE FAILURE MODE we cannot prevent at the pipeline layer.
    // The chip renders with data-tier="canonical" even though the source is a
    // DRAFT — a compliance hazard. Test documents that the safety RELIES on
    // the LLM obeying the system prompt; Task 9 verifies the LLM actually
    // does. Logged here so a future contributor doesn't think the pipeline
    // alone is bulletproof.
    const adversarialLlmText =
      'Vår policy säger att riskbedömningar görs årligen[Källa: Arbetsmiljöpolicy].'

    const tree = buildTree(adversarialLlmText)
    plugin(tree)

    const cites = findCites(tree)
    expect(cites).toHaveLength(1)
    // The LLM-erroneous chip DOES render as canonical — this is the gap.
    expect(tierOf(cites[0]!)).toBe('canonical')
    expect(chipTextOf(cites[0]!)).toBe('Arbetsmiljöpolicy')
    // Mitigation: the live smoke (Task 9) probes for this exact prompt
    // pattern against a DRAFT-only Nordviken seed. If the LLM produces this
    // output, we fix the system prompt — not the pipeline.
  })
})

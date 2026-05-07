/**
 * Story 24.3: LLM disambiguation prompt + Zod response schema for the
 * import-pipeline matcher.
 *
 * Swedish-language instructions wrapping an English-keyed JSON schema
 * (English keys for code stability; Swedish prose for model alignment with
 * the Swedish corpus). System prompt is wrapped via Anthropic's native
 * `cache_control: { type: 'ephemeral' }` for prompt caching (Story 14.26
 * pattern adapted for the raw `@anthropic-ai/sdk` path).
 */

import { z } from 'zod'
import type { MatchCandidate } from '@/lib/search/match-candidates'

// ============================================================================
// System prompt (cached after first call)
// ============================================================================

export const MATCHER_SYSTEM_PROMPT = `Du hjälper Laglig.se att matcha en kunds importerade laglista mot vår katalog.
Givet en källrad och upp till 5 kandidatdokument från vår katalog, välj det mest sannolika.
Källraden kan referera till SFS-lagar, agency-föreskrifter (AFS, MSBFS, NFS, BFS, SOSFS, HSLF-FS, ELSÄK-FS, SKVFS, TSFS, m.fl.), eller EU-förordningar/direktiv.

Returnera JSON med exakta nycklar: {chosen_document_id: string|null, confidence: number 0..1, reasoning: string}.
- reasoning: kort förklaring på svenska, max 2 meningar.
- Om dokumentnummer matchar exakt på en kandidat: confidence ≥ 0.9.
- Om dokumentnummer endast matchar i sifferdelen (samma år och nummer men olika prefix): 0.6–0.85, och förklara osäkerheten.
- Om bara titeln matchar (men nära): 0.6–0.85.
- Om ingen kandidat verkar passa eller källraden är för otydlig: chosen_document_id: null, confidence: < 0.5.
- Var skeptisk till "låg" matchning — false positives är värre än "saknas i katalogen".`

// ============================================================================
// User prompt builder
// ============================================================================

export interface MatcherUserPromptInput {
  titel: string | null
  sfs_nummer: string | null
  omrade: string | null
  kommentar: string | null
  candidates: MatchCandidate[]
}

export function buildMatcherUserPrompt(input: MatcherUserPromptInput): string {
  const candidatesBlock = input.candidates
    .map(
      (c) =>
        `- [${c.document_id}] ${c.title} (${c.document_number ?? c.content_type}) — fuzzy_score: ${c.fuzzy_score.toFixed(2)}`
    )
    .join('\n')

  return `Källrad:
  Titel: ${input.titel ?? '(inget angivet)'}
  Dokumentnummer: ${input.sfs_nummer ?? '(inget angivet)'}
  Område: ${input.omrade ?? '(inget angivet)'}
  Kommentar: ${input.kommentar ?? '(inget angivet)'}

Kandidater:
${candidatesBlock}

Returnera JSON enligt schemat ovan.`
}

// ============================================================================
// Response schema (English keys for code stability)
// ============================================================================

export const LlmMatchResponseSchema = z.object({
  chosen_document_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type LlmMatchResponse = z.infer<typeof LlmMatchResponseSchema>

/**
 * Extracts the JSON object from a model response. Handles both raw JSON and
 * fenced ```json blocks. Returns null on parse failure (caller retries once).
 */
export function extractJson(text: string): unknown | null {
  // First try raw JSON.
  try {
    return JSON.parse(text)
  } catch {
    // Fall through.
  }
  // Then try to extract from a fenced block.
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (match && match[1]) {
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
  // Last resort: find the first {...} balanced span.
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    } catch {
      return null
    }
  }
  return null
}

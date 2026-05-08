/**
 * Story 24.3: Candidate retrieval for the import-pipeline matcher.
 *
 * Given an import-row title + (free-form) document number, returns the top-K
 * candidate documents from the catalog ranked by a fuzzy score. The matcher
 * (`lib/import/matcher.ts`) consumes these and either accepts a high-confidence
 * top hit directly (Branch A short-circuit) or hands the top-5 to an LLM for
 * disambiguation.
 *
 * Three scoring branches per AC 4 (Story 24.3 v0.4):
 *   A. Document-number exact match           → fuzzy_score = 1.0
 *   B. Document-number suffix match (year+number) — prefix differs → +0.4
 *   C. Title trigram + signal boosts          → 0.6 × trigram + bonuses
 *
 * Scoped to import-matching only — does NOT pollute the global search
 * namespace at lib/search/index.ts. Sibling file by design.
 */

import { prisma } from '@/lib/prisma'
import {
  parseDocumentNumber,
  suffixMatches,
  type ParsedDocumentNumber,
} from '@/lib/import/document-number'

export interface MatchCandidate {
  document_id: string
  title: string
  /** Canonical id from `LegalDocument.document_number`. */
  document_number: string | null
  /**
   * `ContentType` enum value as a string — `'SFS_LAW' | 'SFS_AMENDMENT' |
   * 'AGENCY_REGULATION' | 'EU_REGULATION' | 'EU_DIRECTIVE' | ...`. Kept as a
   * plain string here so the matcher (and the LLM prompt) doesn't need to
   * import the Prisma enum.
   */
  content_type: string
  /** 0.0 – 1.0 combined fuzzy score across the three branches. */
  fuzzy_score: number
  match_signals: {
    /** Branch A — `parseDocumentNumber(input).canonical === parseDocumentNumber(candidate.document_number).canonical`. */
    document_number_exact: boolean
    /** Branch B — `suffixMatches()` true (same year+number, different / missing prefix). */
    document_number_suffix_match: boolean
    /** 0.0 – 1.0 trigram similarity from pg_trgm. */
    title_trigram_score: number
    /** Reserved for future use (amendment fuzzy match). Always false in v1. */
    has_amendment_match: boolean
  }
}

export interface FindCandidatesInput {
  titel: string | null
  /**
   * Free-form regulation id from the source row's mapped column. Field name
   * kept as `sfs_nummer` to align with `LawListImportRow.source_sfs_nummer`
   * (24.1 schema) — semantically a generic agency-or-EU document id.
   */
  sfs_nummer: string | null
}

const TRIGRAM_THRESHOLD = 0.3
const DEFAULT_LIMIT = 5

/**
 * Pool size for the Branch B/C candidate query. Pulled wider than the final
 * limit to give the scoring loop a chance to surface a year+number suffix
 * match that ranks low on title-trigram alone.
 */
const TRIGRAM_POOL = 20

interface TrigramRow {
  id: string
  title: string
  document_number: string
  content_type: string
  trgm_score: number
}

/**
 * Detect Series-inferred match for Branch C bonus:
 *   - input parsed series matches candidate parsed series (e.g., both AFS), OR
 *   - input series=null but title contains a hint matching candidate.content_type
 */
function seriesInferredMatch(
  inputParsed: ParsedDocumentNumber | null,
  inputTitle: string | null,
  candidateParsed: ParsedDocumentNumber | null,
  candidateContentType: string
): boolean {
  if (
    inputParsed &&
    candidateParsed &&
    inputParsed.series &&
    candidateParsed.series
  ) {
    return inputParsed.series === candidateParsed.series
  }
  if (!inputTitle) return false
  const t = inputTitle.toLowerCase()
  if (
    (t.includes('afs') || t.includes('föreskrift')) &&
    candidateContentType === 'AGENCY_REGULATION'
  ) {
    return true
  }
  if (
    (t.includes(' eu ') ||
      t.startsWith('eu ') ||
      t.includes('förordning') ||
      t.includes('direktiv')) &&
    (candidateContentType === 'EU_REGULATION' ||
      candidateContentType === 'EU_DIRECTIVE')
  ) {
    return true
  }
  return false
}

/**
 * Find top-K catalog candidates for an import row. Returns up to `limit`
 * candidates ordered by `fuzzy_score` desc.
 *
 * Performance budget: <500ms p95 on a ~10k-doc catalog. Achieved by:
 *   - Branch A: targeted findFirst by document_number when input parses cleanly
 *   - Branch B/C: a single $queryRaw against the gin_trgm_ops index
 */
export async function findMatchCandidates(
  input: FindCandidatesInput,
  limit: number = DEFAULT_LIMIT
): Promise<MatchCandidate[]> {
  const inputParsed = input.sfs_nummer
    ? parseDocumentNumber(input.sfs_nummer)
    : null

  // ----------------------------------------------------------------------
  // Branch A — document-number canonical exact match (highest signal).
  // When the input parses, look up the candidate by its canonical first.
  // For the SFS + agency case this is a direct document_number lookup
  // (catalog stores the same canonical we produce). For EU forms the
  // catalog uses different storage formats (e.g. "Regulation (EU) 2016/679"
  // and "32016R0679"), so we also probe alternative storage forms.
  // ----------------------------------------------------------------------
  let exactHit: TrigramRow | null = null
  if (inputParsed) {
    const altForms = enumerateAltCanonicalForms(inputParsed)
    const exact = await prisma.legalDocument.findFirst({
      where: { document_number: { in: altForms } },
      select: {
        id: true,
        title: true,
        document_number: true,
        content_type: true,
      },
    })
    if (exact) {
      exactHit = {
        id: exact.id,
        title: exact.title,
        document_number: exact.document_number,
        content_type: exact.content_type,
        trgm_score: 0, // not used for exact-hit
      }
    }
  }

  // ----------------------------------------------------------------------
  // Branch B + C — pull the trigram pool so we can score across signals.
  // Skips when title is blank AND we already have an exact hit (no point
  // running an expensive query for nothing).
  // ----------------------------------------------------------------------
  let pool: TrigramRow[] = []
  if (input.titel && input.titel.trim().length > 0) {
    const titleTrim = input.titel.trim()
    pool = await prisma.$queryRaw<TrigramRow[]>`
      SELECT id, title, document_number, content_type::text AS content_type,
             similarity(title, ${titleTrim}) AS trgm_score
      FROM legal_documents
      WHERE similarity(title, ${titleTrim}) > ${TRIGRAM_THRESHOLD}
        AND content_type::text <> 'SFS_AMENDMENT'
      ORDER BY trgm_score DESC
      LIMIT ${TRIGRAM_POOL}
    `
  }

  // ----------------------------------------------------------------------
  // Combine: ensure exactHit is in the pool with score 1.0; score everyone
  // else; pick top-K.
  // ----------------------------------------------------------------------
  const seen = new Set<string>()
  const results: MatchCandidate[] = []

  // Process exactHit first if present.
  if (exactHit) {
    seen.add(exactHit.id)
    const candidateParsed = exactHit.document_number
      ? parseDocumentNumber(exactHit.document_number)
      : null
    results.push({
      document_id: exactHit.id,
      title: exactHit.title,
      document_number: exactHit.document_number,
      content_type: exactHit.content_type,
      fuzzy_score: 1.0,
      match_signals: {
        document_number_exact: true,
        document_number_suffix_match: false,
        title_trigram_score: 0,
        has_amendment_match: false,
      },
    })
    void candidateParsed // not needed after Branch A
  }

  for (const row of pool) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const candidateParsed = row.document_number
      ? parseDocumentNumber(row.document_number)
      : null

    // Branch A retest (in case the trigram pool surfaced a row whose
    // document_number canonical equals the input's — possible if Branch A's
    // initial lookup missed an alt-form variant).
    const exactByCanonical =
      inputParsed != null &&
      candidateParsed != null &&
      inputParsed.canonical === candidateParsed.canonical

    // Branch B
    const suffix =
      !exactByCanonical &&
      inputParsed != null &&
      candidateParsed != null &&
      suffixMatches(inputParsed, candidateParsed)

    // Branch C
    const trgm = Number(row.trgm_score)
    const seriesHint = seriesInferredMatch(
      inputParsed,
      input.titel,
      candidateParsed,
      row.content_type
    )

    let score: number
    if (exactByCanonical) {
      score = 1.0
    } else {
      const suffixBoost = suffix ? 0.4 : 0
      const seriesBoost = seriesHint ? 0.2 : 0
      score = Math.min(1.0, 0.6 * trgm + suffixBoost + seriesBoost)
      // Story 24.3 QA gate DESIGN-001: when the candidate matches by Branch B
      // (suffix tail matches, but the prefix differs from the input), the
      // input is semantically ambiguous — the user wrote "2020:5" without
      // a series prefix and the matcher is guessing which series. Cap the
      // score at 0.84 (just below the HIGH-tier threshold of 0.85) so it
      // routes through the user's review queue at MEDIUM tier instead of
      // auto-accepting at HIGH. Branch A (exact canonical) keeps full 1.0;
      // Branch C alone (no suffix match, just trigram + series-hint) is
      // capped at 0.6×1 + 0.2 = 0.8 by the formula above.
      if (suffix) {
        score = Math.min(score, 0.84)
      }
    }

    results.push({
      document_id: row.id,
      title: row.title,
      document_number: row.document_number,
      content_type: row.content_type,
      fuzzy_score: score,
      match_signals: {
        document_number_exact: exactByCanonical,
        document_number_suffix_match: suffix,
        title_trigram_score: trgm,
        has_amendment_match: false,
      },
    })
  }

  // Sort desc by fuzzy_score, return top-K.
  results.sort((a, b) => b.fuzzy_score - a.fuzzy_score)
  return results.slice(0, limit)
}

/**
 * For Branch A: given a parsed input, return the alternative storage forms
 * the catalog might use for the same logical document. Catalog Task 0
 * verification revealed EU is dual-format ((Regulation (EU) YYYY/NNN) AND
 * (3YYYYRNNNN)), so we probe both shapes.
 */
function enumerateAltCanonicalForms(parsed: ParsedDocumentNumber): string[] {
  const forms = new Set<string>()
  forms.add(parsed.canonical)

  if (parsed.kind === 'EU_REG') {
    // Catalog stores "Regulation (EU) YYYY/NNN" and CELEX "3YYYYRNNNN" (with
    // 4-digit zero-padded number).
    forms.add(`Regulation (EU) ${parsed.year}/${parsed.number}`)
    forms.add(
      `Regulation (${parsed.series ?? 'EU'}) ${parsed.year}/${parsed.number}`
    )
    const padded = parsed.number.padStart(4, '0')
    forms.add(`3${parsed.year}R${padded}`)
  } else if (parsed.kind === 'EU_DIR') {
    forms.add(`Directive (EU) ${parsed.year}/${parsed.number}`)
    const padded = parsed.number.padStart(4, '0')
    forms.add(`3${parsed.year}L${padded}`)
  }

  return [...forms]
}

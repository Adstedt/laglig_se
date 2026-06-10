/**
 * SEO metadata helpers for the public document pages (~50k URLs).
 *
 * Titles: the root layout applies the `'%s | Laglig.se'` template, so page
 * titles must NOT append the brand suffix themselves — doing so renders
 * "… | Laglig.se | Laglig.se".
 *
 * Descriptions: built from structured fields (summary → applicability_hint →
 * law-text excerpt → templated fallback) instead of raw `full_text` slices,
 * which start with the Riksdagen metadata header ("SFS nr:", "Departement…")
 * and produce near-identical boilerplate across the whole document set.
 */

/** Google truncates descriptions around 155–160 chars. */
const MAX_DESCRIPTION_LENGTH = 158

/** Candidates shorter than this read as broken snippets — skip to the next source. */
const MIN_CANDIDATE_LENGTH = 40

export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Truncate at a word boundary and add an ellipsis, never mid-word. */
export function truncateAtWord(
  text: string,
  maxLength = MAX_DESCRIPTION_LENGTH
): string {
  const cleaned = cleanText(text)
  if (cleaned.length <= maxLength) return cleaned
  const cut = cleaned.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const truncated = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return `${truncated.replace(/[\s,;:.\-–—(]+$/, '')}…`
}

/**
 * Swedish law titles usually embed their own number — "Arbetsmiljölag
 * (1977:1160)" — so only append `document_number` when the title doesn't
 * already contain it. Avoids "Arbetsmiljölag (1977:1160) - SFS 1977:1160".
 */
export function documentSeoTitle(
  title: string,
  documentNumber?: string | null
): string {
  const cleanTitle = cleanText(title)
  if (!documentNumber) return cleanTitle
  const bareNumber = documentNumber.replace(/^SFS\s+/i, '').trim()
  if (bareNumber && cleanTitle.includes(bareNumber)) return cleanTitle
  return `${cleanTitle} (${documentNumber})`
}

/**
 * Riksdagen/agency full texts open with a metadata header (title, "SFS nr:",
 * "Departement/myndighet:", dates …). Slice from the first chapter/paragraph/
 * article marker so excerpts start at the actual legal text — typically the
 * scope statement ("Denna lag gäller …"), which makes a strong description.
 */
export function lawTextExcerpt(fullText: string): string | null {
  const idx = fullText.search(/\n\s*(?:\d+\s*kap\.|\d+\s*§|Artikel\s+\d+)/i)
  if (idx === -1) return null
  const body = cleanText(fullText.slice(idx)).replace(/^1\s*§\s*/, '')
  return body.length >= MIN_CANDIDATE_LENGTH ? body : null
}

export interface SeoDescriptionSource {
  summary?: string | null
  applicabilityHint?: string | null
  fullText?: string | null
  /** Templated last resort — should mention the document and Laglig.se. */
  fallback: string
}

export function buildSeoDescription(source: SeoDescriptionSource): string {
  const candidates = [
    source.summary,
    source.applicabilityHint,
    source.fullText ? lawTextExcerpt(source.fullText) : null,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const cleaned = cleanText(candidate)
    if (cleaned.length >= MIN_CANDIDATE_LENGTH) return truncateAtWord(cleaned)
  }
  return truncateAtWord(source.fallback)
}

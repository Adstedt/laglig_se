/**
 * Returns the SFS number of the latest amendment to a base law — the
 * legal-research equivalent of "Ändrad t.o.m.". Sorts by effective_date desc
 * (falling back to publication_date) and returns the amending document's
 * formatted SFS number, or null when no tracked amendments exist.
 *
 * Used by the law-page hero to surface the through-which-amendment the
 * current text is valid. Avoids the brittle HTML regex that no longer
 * matches Riksdagen's current `.lovhead` format.
 */

export interface AmendmentLike {
  effective_date: Date | string | null
  publication_date?: Date | string | null
  amending_law_title?: string | null
  amending_document?: {
    document_number: string
  } | null
}

/**
 * Extracts an SFS number from an amendment title like "Lag (2025:732) om
 * ändring i..." — used as fallback when `amending_document` is NULL (detected
 * amendments where the amending law isn't yet ingested as its own document).
 */
function extractSfsFromTitle(title: string | null | undefined): string | null {
  if (!title) return null
  const m = title.match(/\((\d{4}:\d+)\)/)
  return m ? m[1]! : null
}

/** Resolve the SFS number for a single amendment — prefer the joined document,
 *  fall back to parsing the `amending_law_title`. */
function resolveSfs(a: AmendmentLike): string | null {
  if (a.amending_document?.document_number) {
    return a.amending_document.document_number
  }
  return extractSfsFromTitle(a.amending_law_title)
}

/**
 * Parses an SFS number like "2024:1100" or "SFS 2024:1100" into [year, seq].
 * Returns null when the format is unrecognizable.
 */
function parseSfs(sfs: string | null): [year: number, seq: number] | null {
  if (!sfs) return null
  const m = sfs.match(/(\d{4}):(\d+)/)
  if (!m) return null
  return [parseInt(m[1]!, 10), parseInt(m[2]!, 10)]
}

/**
 * Compares two SFS number tuples — year desc, then sequence desc.
 * Used as the authoritative sort when dates are missing, since an SFS
 * number's year is the year of publication and the sequence increases
 * monotonically within each year.
 */
function compareSfsDesc(
  a: [number, number] | null,
  b: [number, number] | null
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (a[0] !== b[0]) return b[0] - a[0] // year desc
  return b[1] - a[1] // seq desc
}

/** Returns e.g. "SFS 2024:1100" or null when no amendments tracked */
export function getLatestAmendmentSfs(
  amendments: AmendmentLike[]
): string | null {
  if (!amendments || amendments.length === 0) return null

  const withSfs = amendments.filter((a) => resolveSfs(a) !== null)
  if (withSfs.length === 0) return null

  // Sort by: effective_date desc, then publication_date desc, then SFS
  // number (year, seq) desc. The SFS tie-breaker is critical — for many
  // historical amendments effective_date is NULL in our DB, so date-only
  // sorting collapses every null-dated amendment into a tie at time=0 and
  // we pick whichever comes first from Prisma. The SFS number is an
  // authoritative fallback since it's always present and monotonically
  // increases within each year.
  const sorted = [...withSfs].sort((a, b) => {
    const aEff = toTime(a.effective_date)
    const bEff = toTime(b.effective_date)
    if (aEff !== null && bEff !== null && aEff !== bEff) return bEff - aEff
    if (aEff !== null && bEff === null) return -1
    if (aEff === null && bEff !== null) return 1

    const aPub = toTime(a.publication_date)
    const bPub = toTime(b.publication_date)
    if (aPub !== null && bPub !== null && aPub !== bPub) return bPub - aPub
    if (aPub !== null && bPub === null) return -1
    if (aPub === null && bPub !== null) return 1

    return compareSfsDesc(parseSfs(resolveSfs(a)), parseSfs(resolveSfs(b)))
  })

  const latest = sorted[0]
  if (!latest) return null
  const sfs = resolveSfs(latest)
  if (!sfs) return null

  // Normalize "1977:1160" → "SFS 1977:1160"
  return sfs.startsWith('SFS') ? sfs : `SFS ${sfs}`
}

function toTime(d: Date | string | null | undefined): number | null {
  if (!d) return null
  if (typeof d === 'string') {
    const t = new Date(d).getTime()
    return Number.isFinite(t) ? t : null
  }
  return d.getTime()
}

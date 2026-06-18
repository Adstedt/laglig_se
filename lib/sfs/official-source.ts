/**
 * Resolves the best *official* external source link for an SFS document.
 *
 * Historically every law/amendment page linked to the raw Riksdagen data API
 * (`https://data.riksdagen.se/dokument/{id}`) or the `riksdagen.se/.../_sfs-…/`
 * human page (which 404s for amendments). Neither is reader-friendly. This
 * helper points users at the authentic published text instead:
 *
 *  - SFS published 2018-04-01 onward (digital authentic era): the
 *    svenskforfattningssamling.se document page, which carries the official PDF.
 *  - Older base laws: the Regeringskansliet consolidated full text on
 *    rkrattsbaser.gov.se (`sfst`), which covers every year.
 *  - Older amendments: no usable standalone page exists on either site
 *    (`sfst`/`sfsr` only serve consolidated base laws), so this returns null.
 *    Callers should prefer the self-hosted amendment PDF (getPublicPdfUrl on the
 *    stored storage_path) and only fall back to the raw source_url as a last resort.
 *  - Malformed/non-SFS numbers (e.g. "N2020:7"): returns null — never guess a URL.
 *
 * Pure string logic only (no I/O), safe to import from both server and client
 * components.
 */
import { parseSfsNumber } from './pdf-urls'

/** SFS became the authentic, digitally published version on 2018-04-01. */
const DIGITAL_ERA_START = new Date('2018-04-01T00:00:00.000Z')

export interface OfficialSfsSource {
  url: string
  /** Short label describing the destination, for the link text. */
  label: string
}

function isDigitalEra(publicationDate?: Date | string | null): boolean {
  if (!publicationDate) return false
  const d =
    publicationDate instanceof Date
      ? publicationDate
      : new Date(publicationDate)
  if (Number.isNaN(d.getTime())) return false
  return d >= DIGITAL_ERA_START
}

/**
 * @param documentNumber e.g. "SFS 2026:1134" or "2026:1134"
 * @param publicationDate used to decide the digital-era cutoff (null = treat as pre-digital)
 * @param contentType "SFS_LAW" | "SFS_AMENDMENT" — gates the pre-2018 rkrattsbaser fallback
 * @returns the official source link, or null if no reliable one can be constructed
 */
export function getOfficialSfsSource(
  documentNumber: string,
  publicationDate?: Date | string | null,
  contentType?: string
): OfficialSfsSource | null {
  const parsed = parseSfsNumber(documentNumber)
  if (!parsed) return null // malformed / non-SFS (e.g. "N2020:7") — never guess
  const { year, number } = parsed

  if (isDigitalEra(publicationDate)) {
    // Authentic published version (base law or amendment) with the official PDF.
    return {
      url: `https://svenskforfattningssamling.se/doc/${year}${number}.html`,
      label: 'Svensk författningssamling',
    }
  }

  // Pre-digital: rkrattsbaser's sfst only serves consolidated *base* laws.
  // Amendments are not retrievable there by their own number, so bail and let
  // the caller use the self-hosted PDF / stored source_url instead.
  if (contentType === 'SFS_AMENDMENT') return null

  return {
    url: `https://rkrattsbaser.gov.se/sfst?bet=${year}:${number}`,
    label: 'Lagtext (Regeringskansliet)',
  }
}

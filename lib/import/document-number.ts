/**
 * Story 24.3: Generalised document-number parser for the import matcher.
 *
 * Replaces the originally-planned `normalizeSfsId` (SFS-only) with a parser
 * that handles the open-set of agency prefixes (SFS, AFS, MSBFS, NFS, BFS,
 * SOSFS, HSLF-FS, ELSÄK-FS, SSMFS, SRVFS, KIFS, SCB-FS, SKVFS, TSFS, STAFS,
 * MCFFS — and any FUTURE agency code without a code change) plus EU
 * regulations / directives in their multiple stored forms.
 *
 * Story 24.3 Task 0 — verified canonical formats stored in
 * `LegalDocument.document_number`:
 *   SFS_LAW           → "SFS YYYY:NNN"
 *   SFS_AMENDMENT     → "SFS YYYY:NNN"
 *   AGENCY_REGULATION → "<PREFIX> YYYY:NNN" with open-set prefixes;
 *                       sometimes "<PREFIX> YYYY:NNN kap. N" for chapter slices
 *   EU_REGULATION     → "Regulation (EU) YYYY/NNN"  (newer ingestion path)
 *                       OR "3YYYYRNNNN"             (CELEX, older path)
 *   EU_DIRECTIVE      → "Directive (EU) YYYY/NNN" / "3YYYYL NNNN" (CELEX)
 *
 * The catalog's dual-format EU storage is the reason Branch B (year+number
 * suffix-fallback) in `findMatchCandidates` exists: simple Branch A canonical
 * exact-match cannot bridge "(EU) 2016/679" ↔ "32016R0679" alone.
 *
 * Pure function. No I/O, no Prisma. Used by both `lib/search/match-candidates.ts`
 * and `lib/import/matcher.ts`.
 */

export type DocumentNumberKind = 'SFS_LIKE' | 'EU_REG' | 'EU_DIR' | 'OTHER'

export interface ParsedDocumentNumber {
  /**
   * Captured prefix in canonical (uppercase) form — e.g. "SFS", "AFS",
   * "MSBFS", "HSLF-FS", "EU", "EG". Open-ended set: do NOT close this into
   * an enum at any consumer. `null` when the input has no recognisable
   * prefix (e.g. bare "1977:1160" or "2016/679").
   */
  series: string | null
  /**
   * Full canonical id. For SFS-like inputs this matches the format stored in
   * `LegalDocument.document_number`; for EU inputs this is the short paren
   * form (`(EU) 2016/679` for regs, `2016/679/EU` for dirs) which the catalog
   * stores in multiple variants — see Branch B in match-candidates.ts.
   *
   * Leading zeros on the number are PRESERVED for SFS-like inputs (matches
   * "SFS 1962:0381" canonical form). For CELEX-decoded inputs the number is
   * unpadded ("(EU) 2020/39", not "(EU) 2020/0039") because Swedish
   * legalese rarely shows the leading zeros once outside CELEX itself.
   */
  canonical: string
  /** Year as a 4-digit string. */
  year: string
  /** Number component as a string (preserves leading zeros for SFS-like). */
  number: string
  /** Coarse kind used by the matcher to pick scoring branches. */
  kind: DocumentNumberKind
}

/**
 * Parse a free-form document-number string into a structured form, or
 * return null if no pattern matches. Whitespace is trimmed and internal
 * runs collapsed before pattern matching.
 *
 * Patterns are tried in order; first match wins.
 */
export function parseDocumentNumber(raw: string): ParsedDocumentNumber | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  if (cleaned.length === 0) return null

  // ----------------------------------------------------------------------
  // Pattern 1: Agency / SFS prefixed — open-set capture.
  //   "SFS 1977:1160", "AFS 2020:5", "HSLF-FS 2022:30", "AFS 2023:15 kap. 8"
  // Allows trailing content (e.g. " kap. 8") so chapter-sliced rows in the
  // catalog parse into the same canonical as their parent. Branch A
  // exact-match in match-candidates.ts compares on the canonical, so the
  // chapter suffix doesn't block matching.
  // ----------------------------------------------------------------------
  const prefixed = cleaned.match(/^([A-ZÅÄÖ][A-ZÅÄÖ\-]+)\s+(\d{4}):(\d{1,5})/i)
  if (prefixed) {
    const series = prefixed[1]!.toUpperCase()
    const year = prefixed[2]!
    const number = prefixed[3]!
    return {
      series,
      canonical: `${series} ${year}:${number}`,
      year,
      number,
      kind: 'SFS_LIKE',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 2: Bare YYYY:NNN (no prefix). Common when users paste Notisum
  // exports that strip the prefix because every row in the column is the
  // same series. canonical lacks the prefix; suffix-match Branch B covers
  // disambiguation across content_types.
  // ----------------------------------------------------------------------
  const bareSfs = cleaned.match(/^(\d{4}):(\d{1,5})$/)
  if (bareSfs) {
    return {
      series: null,
      canonical: `${bareSfs[1]}:${bareSfs[2]}`,
      year: bareSfs[1]!,
      number: bareSfs[2]!,
      kind: 'SFS_LIKE',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 3: EU regulation, paren form — "(EU) 2016/679", "(EG) 1907/2006".
  // ----------------------------------------------------------------------
  const euParen = cleaned.match(/^\((EU|EG|EEG|Euratom)\)\s+(\d{4})\/(\d+)$/i)
  if (euParen) {
    const series = euParen[1]!.toUpperCase()
    const year = euParen[2]!
    const number = euParen[3]!
    return {
      series,
      canonical: `(${series}) ${year}/${number}`,
      year,
      number,
      kind: 'EU_REG',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 4: EU directive trailing form — "2010/75/EU", "2014/24/EU".
  // ----------------------------------------------------------------------
  const euDirective = cleaned.match(/^(\d{4})\/(\d+)\/(EU|EG|EEG)$/i)
  if (euDirective) {
    const series = euDirective[3]!.toUpperCase()
    const year = euDirective[1]!
    const number = euDirective[2]!
    return {
      series,
      canonical: `${year}/${number}/${series}`,
      year,
      number,
      kind: 'EU_DIR',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 5: EU bare — "2016/679", "2024/3239". Treated as EU_REG by
  // default; the matcher's series_inferred_match falls back to title hints
  // ("direktiv" → EU_DIR) when the user doesn't include a prefix.
  // ----------------------------------------------------------------------
  const euBare = cleaned.match(/^(\d{4})\/(\d+)$/)
  if (euBare) {
    return {
      series: null,
      canonical: `${euBare[1]}/${euBare[2]}`,
      year: euBare[1]!,
      number: euBare[2]!,
      kind: 'EU_REG',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 6: CELEX regulation — "32016R0679", "32020R1413".
  //   3 = sector "EU law", YYYY = year, R = regulation, NNNN = number.
  // We strip the leading zeros on number for the canonical (Swedish
  // legalese doesn't typically show "2020/0039" — it shows "2020/39").
  // ----------------------------------------------------------------------
  const celexReg = cleaned.match(/^3(\d{4})R0*(\d+)$/i)
  if (celexReg) {
    const year = celexReg[1]!
    const number = celexReg[2]!
    return {
      series: 'EU',
      canonical: `(EU) ${year}/${number}`,
      year,
      number,
      kind: 'EU_REG',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 7: CELEX directive — "32020L1833".
  // ----------------------------------------------------------------------
  const celexDir = cleaned.match(/^3(\d{4})L0*(\d+)$/i)
  if (celexDir) {
    const year = celexDir[1]!
    const number = celexDir[2]!
    return {
      series: 'EU',
      canonical: `${year}/${number}/EU`,
      year,
      number,
      kind: 'EU_DIR',
    }
  }

  // ----------------------------------------------------------------------
  // Pattern 8: "Regulation (EU) YYYY/NNN" / "Directive (EU) YYYY/NNN" —
  // the format the catalog stores under EU_REGULATION / EU_DIRECTIVE.
  // Important: parseDocumentNumber is called on candidate document_numbers
  // too (in match-candidates.ts) so Branch B can compare year+number
  // across the input/candidate pair regardless of which form each side has.
  // ----------------------------------------------------------------------
  const regulationPrefix = cleaned.match(
    /^Regulation\s+\((EU|EG|EEG)\)\s+(\d{4})\/(\d+)$/i
  )
  if (regulationPrefix) {
    const series = regulationPrefix[1]!.toUpperCase()
    const year = regulationPrefix[2]!
    const number = regulationPrefix[3]!
    return {
      series,
      canonical: `(${series}) ${year}/${number}`,
      year,
      number,
      kind: 'EU_REG',
    }
  }
  const directivePrefix = cleaned.match(
    /^Directive\s+\((EU|EG|EEG)\)\s+(\d{4})\/(\d+)$/i
  )
  if (directivePrefix) {
    const series = directivePrefix[1]!.toUpperCase()
    const year = directivePrefix[2]!
    const number = directivePrefix[3]!
    return {
      series,
      canonical: `${year}/${number}/${series}`,
      year,
      number,
      kind: 'EU_DIR',
    }
  }

  return null
}

/**
 * True when two parsed document numbers share the same year+number tail,
 * regardless of series prefix. Used for Branch B (suffix fallback) in the
 * matcher when the input had a missing or different prefix than the
 * candidate.
 */
export function suffixMatches(
  a: ParsedDocumentNumber,
  b: ParsedDocumentNumber
): boolean {
  // Strip leading zeros for comparison so "2020/39" suffix-matches "2020/0039"
  const stripZeros = (n: string) => n.replace(/^0+(?=\d)/, '')
  return a.year === b.year && stripZeros(a.number) === stripZeros(b.number)
}

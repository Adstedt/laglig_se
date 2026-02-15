/**
 * Legal reference detection for Swedish legal documents
 *
 * Detects references to SFS laws, agency regulations, and court cases
 * in plain text. Returns structured data with match positions for
 * downstream linkification.
 */

export interface DetectedReference {
  /** The full matched text (e.g., "lagen (2012:295)") */
  matchedText: string
  /** Normalized document number (e.g., "SFS 2012:295") */
  documentNumber: string
  /** Content type category for routing */
  contentType: 'SFS_LAW' | 'AGENCY_REGULATION' | 'COURT_CASE'
  /** Court identifier for court cases (e.g., "hd", "ad") */
  courtId?: string
  /** Chapter number for section deep-links (e.g., "2" from "2 kap. 31 §") */
  chapter?: string
  /** Section number for section deep-links (e.g., "31" from "2 kap. 31 §") */
  section?: string
  /** Start index in the input text */
  start: number
  /** End index (exclusive) in the input text */
  end: number
}

// --- SFS Law Patterns ---
// Matches: "lag (2012:295)", "lagen (2012:295)", "förordning (2018:1472)", "förordningen (2018:1472)"
// Also compound names: "aktiebolagslagen (2005:551)", "skolförordningen (2011:185)"
// Optionally preceded by section/chapter: "5 § lagen (2012:295)", "2 kap. 3 § lagen (2012:295)"
// Handles "stycket" between § and law name: "4 kap. 49 § första stycket aktiebolagslagen (2005:551)"
// Capture groups: (1) chapter, (2) section, (3) SFS number
const STYCKET_ORDINALS =
  '(?:första|andra|tredje|fjärde|femte|sjätte|sjunde|åttonde|nionde|tionde)'
const SFS_LAW_PATTERN = new RegExp(
  `(?:(?:(\\d+)\\s+kap\\.\\s+)?(\\d+)\\s*(?:–\\d+\\s*)?§§?\\s+(?:${STYCKET_ORDINALS}\\s+stycket\\s+(?:\\d+\\s+)?)?)?[a-zåäöA-ZÅÄÖ]*(?:lag(?:en)?|förordning(?:en)?)\\s*\\((\\d{4}:\\d+)\\)`,
  'gi'
)

// --- Agency Regulation Patterns ---
// Matches: "AFS 2001:1", "MSBFS 2020:7", "NFS 2016:8", "TSFS 2009:131", etc.
// Also hyphenated: "ELSÄK-FS 2022:1", "SCB-FS 2025:19"
// Generic pattern for any {PREFIX}[-]FS YYYY:N
const AGENCY_REG_PATTERN = /[A-ZÅÄÖ]+-?FS\s+\d{4}:\d+/g

// --- Court Case Patterns ---
// NJA (HD - Högsta domstolen): "NJA 2020 s. 45"
const NJA_PATTERN = /NJA\s+\d{4}\s+s\.\s*\d+/g

// HFD (Högsta förvaltningsdomstolen): "HFD 2020 ref. 5"
const HFD_PATTERN = /HFD\s+\d{4}\s+ref\.\s*\d+/g

// RÅ (old HFD name): "RÅ 2010 ref. 1"
const RA_PATTERN = /RÅ\s+\d{4}\s+ref\.\s*\d+/g

// AD (Arbetsdomstolen): "AD 2019 nr 45"
const AD_PATTERN = /AD\s+\d{4}\s+nr\s+\d+/g

// MÖD (Mark- och miljööverdomstolen): "MÖD 2018:3"
const MOD_PATTERN = /MÖD\s+\d{4}:\d+/g

// MIG (Migrationsöverdomstolen): "MIG 2017:1"
const MIG_PATTERN = /MIG\s+\d{4}:\d+/g

interface CourtPattern {
  pattern: RegExp
  courtId: string
  /** Function to normalize matched text into a document_number */
  normalize: (_match: string) => string
}

const COURT_PATTERNS: CourtPattern[] = [
  {
    pattern: NJA_PATTERN,
    courtId: 'hd',
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
  {
    pattern: HFD_PATTERN,
    courtId: 'hfd',
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
  {
    pattern: RA_PATTERN,
    courtId: 'hfd', // RÅ is the old name for HFD
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
  {
    pattern: AD_PATTERN,
    courtId: 'ad',
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
  {
    pattern: MOD_PATTERN,
    courtId: 'mod',
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
  {
    pattern: MIG_PATTERN,
    courtId: 'mig',
    normalize: (m) => m.replace(/\s+/g, ' '),
  },
]

/**
 * Detect all legal references in a plain text string.
 *
 * Returns non-overlapping matches with longest-match-wins resolution.
 */
export function detectReferences(text: string): DetectedReference[] {
  const candidates: DetectedReference[] = []

  // SFS laws
  for (const match of text.matchAll(new RegExp(SFS_LAW_PATTERN.source, 'gi'))) {
    const chapter = match[1]
    const section = match[2]
    const sfsNumber = match[3]!
    candidates.push({
      matchedText: match[0],
      documentNumber: `SFS ${sfsNumber}`,
      contentType: 'SFS_LAW',
      ...(chapter && { chapter }),
      ...(section && { section }),
      start: match.index!,
      end: match.index! + match[0].length,
    })
  }

  // Agency regulations
  for (const match of text.matchAll(
    new RegExp(AGENCY_REG_PATTERN.source, 'g')
  )) {
    candidates.push({
      matchedText: match[0],
      documentNumber: match[0].replace(/\s+/g, ' '),
      contentType: 'AGENCY_REGULATION',
      start: match.index!,
      end: match.index! + match[0].length,
    })
  }

  // Court cases
  for (const court of COURT_PATTERNS) {
    for (const match of text.matchAll(new RegExp(court.pattern.source, 'g'))) {
      candidates.push({
        matchedText: match[0],
        documentNumber: court.normalize(match[0]),
        contentType: 'COURT_CASE',
        courtId: court.courtId,
        start: match.index!,
        end: match.index! + match[0].length,
      })
    }
  }

  return resolveOverlaps(candidates)
}

/**
 * Resolve overlapping matches by keeping the longest match.
 * If two matches have the same length, keep the one that starts first.
 */
function resolveOverlaps(candidates: DetectedReference[]): DetectedReference[] {
  if (candidates.length <= 1) return candidates

  // Sort by start position, then by length (longest first) for tie-breaking
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - b.start - (a.end - a.start)
  })

  const result: DetectedReference[] = [sorted[0]!]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!
    const last = result[result.length - 1]!

    // If current starts after last ends, no overlap
    if (current.start >= last.end) {
      result.push(current)
    }
    // Otherwise it overlaps — keep the longer one (already in result if same start,
    // or already picked if it started earlier). If the current is longer, replace.
    else if (current.end - current.start > last.end - last.start) {
      result[result.length - 1] = current
    }
    // Otherwise skip (the existing one is longer or equal)
  }

  return result
}

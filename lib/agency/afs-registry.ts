/**
 * AFS Document Registry — Classification of all 15 AFS 2023-series documents
 * Story 9.1: Three-tier classification for ingestion pipeline
 *
 * Tier 1 (STANDALONE): Flat § numbering, single regulatory domain
 * Tier 2 (KEEP_WHOLE): Has kap. notation but chapters are organizational subdivisions of one area
 * Tier 3 (SPLIT): Has kap. notation where chapters cover distinct regulatory domains
 */

// ============================================================================
// Types
// ============================================================================

export type AfsTier = 'STANDALONE' | 'KEEP_WHOLE' | 'SPLIT'

export interface AfsChapter {
  /** Chapter number (kap. N) */
  number: number
  /** Swedish title */
  title: string
}

export interface AfsAmendment {
  /** Amendment number, e.g. "AFS 2024:1" */
  number: string
  /** Which AFS it modifies */
  modifies: string
  /** Effective date or "TBD" */
  effectiveDate: string
}

export interface AfsDocument {
  /** Document number, e.g. "AFS 2023:1" */
  documentNumber: string
  /** Full Swedish title */
  title: string
  /** Classification tier */
  tier: AfsTier
  /** Number of chapters (1 for standalone) */
  chapterCount: number
  /** Chapter definitions for SPLIT documents (kap. 2+, excludes kap. 1) */
  chapters: AfsChapter[]
  /** Whether the document has avdelningar (divisions grouping chapters) */
  hasAvdelningar: boolean
  /** Latest amendment incorporated in the consolidated version */
  consolidatedThrough: string | null
  /** Known amendments to this document */
  amendments: AfsAmendment[]
}

// ============================================================================
// Amendment Registry
// ============================================================================

export const AFS_AMENDMENTS: AfsAmendment[] = [
  { number: 'AFS 2024:1', modifies: 'AFS 2023:3', effectiveDate: '2025-01-01' },
  { number: 'AFS 2024:2', modifies: 'AFS 2023:4', effectiveDate: '2025-01-01' },
  {
    number: 'AFS 2024:3',
    modifies: 'AFS 2023:10',
    effectiveDate: '2025-01-01',
  },
  {
    number: 'AFS 2024:4',
    modifies: 'AFS 2023:11',
    effectiveDate: '2025-01-01',
  },
  {
    number: 'AFS 2025:1',
    modifies: 'AFS 2023:10',
    effectiveDate: '2025-08-01',
  },
  {
    number: 'AFS 2025:2',
    modifies: 'AFS 2023:14',
    effectiveDate: '2026-04-09',
  },
  { number: 'AFS 2025:3', modifies: 'AFS 2023:15', effectiveDate: 'TBD' },
  {
    number: 'AFS 2025:4',
    modifies: 'AFS 2023:15',
    effectiveDate: '2029-01-01',
  },
  { number: 'AFS 2025:5', modifies: 'AFS 2023:14', effectiveDate: 'TBD' },
  { number: 'AFS 2025:6', modifies: 'AFS 2023:13', effectiveDate: 'TBD' },
  { number: 'AFS 2025:7', modifies: 'AFS 2023:15', effectiveDate: 'TBD' },
  { number: 'AFS 2025:8', modifies: 'AFS 2023:13', effectiveDate: 'TBD' },
]

// ============================================================================
// Full Document Registry
// ============================================================================

function getAmendmentsFor(docNumber: string): AfsAmendment[] {
  return AFS_AMENDMENTS.filter((a) => a.modifies === docNumber)
}

function getConsolidatedThrough(docNumber: string): string | null {
  const amendments = getAmendmentsFor(docNumber)
  if (amendments.length === 0) return null
  // Return the latest amendment number (sorted by number descending)
  return amendments
    .map((a) => a.number)
    .sort()
    .pop()!
}

export const AFS_REGISTRY: AfsDocument[] = [
  // =========================================================================
  // Tier 1: STANDALONE (6 documents → 6 entries)
  // =========================================================================
  {
    documentNumber: 'AFS 2023:1',
    title: 'Systematiskt arbetsmiljöarbete',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:1'),
    amendments: getAmendmentsFor('AFS 2023:1'),
  },
  {
    documentNumber: 'AFS 2023:4',
    title: 'Produkter – maskiner',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:4'),
    amendments: getAmendmentsFor('AFS 2023:4'),
  },
  {
    documentNumber: 'AFS 2023:5',
    title: 'Produkter – tryckbärande anordningar',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:5'),
    amendments: getAmendmentsFor('AFS 2023:5'),
  },
  {
    documentNumber: 'AFS 2023:6',
    title: 'Produkter – enkla tryckkärl',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:6'),
    amendments: getAmendmentsFor('AFS 2023:6'),
  },
  {
    documentNumber: 'AFS 2023:8',
    title: 'Produkter – förbud ledade skärverktyg röjsågar',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:8'),
    amendments: getAmendmentsFor('AFS 2023:8'),
  },
  {
    documentNumber: 'AFS 2023:14',
    title: 'Gränsvärden för luftvägsexponering',
    tier: 'STANDALONE',
    chapterCount: 1,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:14'),
    amendments: getAmendmentsFor('AFS 2023:14'),
  },

  // =========================================================================
  // Tier 2: KEEP_WHOLE (3 documents → 3 entries)
  // =========================================================================
  {
    documentNumber: 'AFS 2023:3',
    title: 'Projektering och byggarbetsmiljösamordning',
    tier: 'KEEP_WHOLE',
    chapterCount: 11,
    chapters: [],
    hasAvdelningar: true,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:3'),
    amendments: getAmendmentsFor('AFS 2023:3'),
  },
  {
    documentNumber: 'AFS 2023:7',
    title: 'Produkter – utrustning explosiva atmosfärer',
    tier: 'KEEP_WHOLE',
    chapterCount: 4,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:7'),
    amendments: getAmendmentsFor('AFS 2023:7'),
  },
  {
    documentNumber: 'AFS 2023:12',
    title: 'Utformning av arbetsplatser',
    tier: 'KEEP_WHOLE',
    chapterCount: 7,
    chapters: [],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:12'),
    amendments: getAmendmentsFor('AFS 2023:12'),
  },

  // =========================================================================
  // Tier 3: SPLIT (6 documents → 6 parents + 66 chapter entries)
  // =========================================================================
  {
    documentNumber: 'AFS 2023:2',
    title: 'Planering och organisering',
    tier: 'SPLIT',
    chapterCount: 9,
    chapters: [
      { number: 2, title: 'Organisatorisk och social arbetsmiljö' },
      { number: 3, title: 'Arbetsanpassning' },
      { number: 4, title: 'Första hjälpen och krisstöd' },
      { number: 5, title: 'Våld och hot om våld' },
      { number: 6, title: 'Ensamarbete' },
      { number: 7, title: 'Gravida, nyförlösta och ammande arbetstagare' },
      { number: 8, title: 'Minderårigas arbetsmiljö' },
      { number: 9, title: 'Anteckningar om jourtid, övertid och mertid' },
    ],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:2'),
    amendments: getAmendmentsFor('AFS 2023:2'),
  },
  {
    documentNumber: 'AFS 2023:9',
    title: 'Produkter – stegar, ställningar, trycksatta',
    tier: 'SPLIT',
    chapterCount: 6,
    chapters: [
      {
        number: 2,
        title: 'Produktkrav för arbetskorgar för tillfälliga personlyft',
      },
      { number: 3, title: 'Produktkrav för fallskyddsnät för personskydd' },
      { number: 4, title: 'Produktkrav för stegar och arbetsbockar' },
      { number: 5, title: 'Produktkrav för ställningar och väderskydd' },
      { number: 6, title: 'Produktkrav för trycksatta anordningar' },
    ],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:9'),
    amendments: getAmendmentsFor('AFS 2023:9'),
  },
  {
    documentNumber: 'AFS 2023:10',
    title: 'Risker i arbetsmiljön',
    tier: 'SPLIT',
    chapterCount: 13,
    chapters: [
      { number: 2, title: 'Buller' },
      { number: 3, title: 'Vibrationer' },
      { number: 4, title: 'Skydd mot skada genom fall' },
      { number: 5, title: 'Skydd mot skada genom ras' },
      { number: 6, title: 'Belastningsergonomi' },
      { number: 7, title: 'Övergripande bestämmelser för kemiska riskkällor' },
      {
        number: 8,
        title: 'Ytterligare bestämmelser för vissa grupper av kemiska ämnen',
      },
      {
        number: 9,
        title: 'Kompletterande bestämmelser för vissa riskfyllda arbeten',
      },
      {
        number: 10,
        title: 'Kompletterande bestämmelser för vissa kemiska riskkällor',
      },
      { number: 11, title: 'Smittrisker' },
      { number: 12, title: 'Artificiell optisk strålning' },
      { number: 13, title: 'Elektromagnetiska fält' },
    ],
    hasAvdelningar: true,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:10'),
    amendments: getAmendmentsFor('AFS 2023:10'),
  },
  {
    documentNumber: 'AFS 2023:11',
    title: 'Arbetsutrustning och personlig skyddsutrustning',
    tier: 'SPLIT',
    chapterCount: 15,
    chapters: [
      { number: 2, title: 'Användning av arbetsutrustning' },
      { number: 3, title: 'Användning av bildskärmar' },
      { number: 4, title: 'Användning av truckar' },
      { number: 5, title: 'Användning av motorkedjesågar och röjsågar' },
      { number: 6, title: 'Användning av traktorer' },
      { number: 7, title: 'Användning av stegar och arbetsbockar' },
      { number: 8, title: 'Användning av ställningar' },
      { number: 9, title: 'Användning av trycksatta anordningar' },
      { number: 10, title: 'Kontroll av trycksatta anordningar' },
      { number: 11, title: 'Användning av lyftanordningar och lyftredskap' },
      { number: 12, title: 'Krav vid tillfälliga personlyft' },
      { number: 13, title: 'Besiktning av lyftanordningar' },
      { number: 14, title: 'Användning av pressar och gradsaxar' },
      { number: 15, title: 'Val och användning av personlig skyddsutrustning' },
    ],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:11'),
    amendments: getAmendmentsFor('AFS 2023:11'),
  },
  {
    documentNumber: 'AFS 2023:13',
    title: 'Risker vid vissa typer av arbeten',
    tier: 'SPLIT',
    chapterCount: 17,
    chapters: [
      { number: 2, title: 'Arbete med djur' },
      { number: 3, title: 'Arbete med risk för exponering för asbest' },
      { number: 4, title: 'Berg- och gruvarbete' },
      { number: 5, title: 'Byggnads- och anläggningsarbete' },
      { number: 6, title: 'Dykeriarbete' },
      { number: 7, title: 'Frisörarbete' },
      { number: 8, title: 'Hamnarbete' },
      {
        number: 9,
        title: 'Innesluten användning av genetiskt modifierade mikroorganismer',
      },
      { number: 10, title: 'Arbete i kylda livsmedelslokaler' },
      { number: 11, title: 'Mast- och stolparbete' },
      { number: 12, title: 'Provning med över- eller undertryck' },
      {
        number: 13,
        title: 'Reparation och service av fordon och fordonsmotorer',
      },
      { number: 14, title: 'Rök- och kemdykning' },
      { number: 15, title: 'Smältning och gjutning av metall' },
      { number: 16, title: 'Sprängarbete' },
      {
        number: 17,
        title: 'Arbete med vintervägshållning och snöskottning på tak',
      },
    ],
    hasAvdelningar: false,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:13'),
    amendments: getAmendmentsFor('AFS 2023:13'),
  },
  {
    documentNumber: 'AFS 2023:15',
    title: 'Medicinska kontroller i arbetslivet',
    tier: 'SPLIT',
    chapterCount: 12,
    chapters: [
      { number: 2, title: 'Generella bestämmelser' },
      { number: 3, title: 'Vibrationer, handintensivt arbete och nattarbete' },
      { number: 4, title: 'Allergiframkallande kemiska ämnen' },
      {
        number: 5,
        title:
          'Allergiframkallande kemiska ämnen – med krav på tjänstbarhetsintyg',
      },
      {
        number: 6,
        title: 'Fibrosframkallande damm – med krav på tjänstbarhetsintyg',
      },
      {
        number: 7,
        title:
          'Metaller – med krav på tjänstbarhetsintyg och biologisk exponeringskontroll',
      },
      {
        number: 8,
        title:
          'Stor fysisk ansträngning i arbetet – med krav på tjänstbarhetsintyg',
      },
      {
        number: 9,
        title: 'Ytterligare fall där medicinska kontroller kan krävas',
      },
      {
        number: 10,
        title: 'Hälsoundersökning av flygpersonal inom civilflyget',
      },
      {
        number: 11,
        title: 'Hälsoundersökningar i Arbetsmiljöverkets övriga föreskrifter',
      },
      { number: 12, title: 'Läkares anmälan och läkares rekommendationer' },
    ],
    hasAvdelningar: true,
    consolidatedThrough: getConsolidatedThrough('AFS 2023:15'),
    amendments: getAmendmentsFor('AFS 2023:15'),
  },
]

// ============================================================================
// Lookup Helpers
// ============================================================================

/** Get a document by its document number */
export function getAfsDocument(
  documentNumber: string
): AfsDocument | undefined {
  return AFS_REGISTRY.find((d) => d.documentNumber === documentNumber)
}

/** Get all documents for a given tier */
export function getAfsByTier(tier: AfsTier): AfsDocument[] {
  return AFS_REGISTRY.filter((d) => d.tier === tier)
}

/** Get total expected entry count across all tiers */
export function getTotalEntryCount(): number {
  let count = 0
  for (const doc of AFS_REGISTRY) {
    if (doc.tier === 'SPLIT') {
      count += 1 + doc.chapters.length // parent + chapter entries
    } else {
      count += 1 // single entry
    }
  }
  return count
}

// ============================================================================
// Document Number / Title Formatting
// ============================================================================

/**
 * Generate the chapter document_number format.
 * e.g. "AFS 2023:10 kap. 3"
 */
export function formatChapterDocumentNumber(
  parentDocNumber: string,
  chapterNumber: number
): string {
  return `${parentDocNumber} kap. ${chapterNumber}`
}

/**
 * Generate the chapter title format.
 * e.g. "Risker i arbetsmiljön — kap. 3: Vibrationer"
 */
export function formatChapterTitle(
  parentTitle: string,
  chapterNumber: number,
  chapterTitle: string
): string {
  return `${parentTitle} — kap. ${chapterNumber}: ${chapterTitle}`
}

/**
 * Generate a URL-safe slug from a document number.
 * e.g. "AFS 2023:10 kap. 3" → "afs-2023-10-kap-3"
 */
export function generateAfsSlug(documentNumber: string): string {
  return documentNumber
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/:/g, '-')
    .replace(/\./g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================================================
// Omnibus Detection Utility (AC 21-23)
// ============================================================================

/**
 * Detect whether an HTML document uses kap. (chapter) notation.
 * Scans for patterns like "kap." or "Kapitel" followed by a number.
 * Used by the ingestion pipeline and future monitoring story (9.5).
 */
export function detectKapitelNotation(htmlOrText: string): {
  hasKapitel: boolean
  chapterNumbers: number[]
} {
  const chapterNumbers: number[] = []

  // Match "N kap." pattern (Swedish legal chapter notation)
  const kapPattern = /(\d+)\s*kap\./gi
  let match
  while ((match = kapPattern.exec(htmlOrText)) !== null) {
    const num = parseInt(match[1]!, 10)
    if (!chapterNumbers.includes(num)) {
      chapterNumbers.push(num)
    }
  }

  // Also match "Kapitel N" pattern
  const kapitelPattern = /Kapitel\s+(\d+)/gi
  while ((match = kapitelPattern.exec(htmlOrText)) !== null) {
    const num = parseInt(match[1]!, 10)
    if (!chapterNumbers.includes(num)) {
      chapterNumbers.push(num)
    }
  }

  chapterNumbers.sort((a, b) => a - b)

  return {
    hasKapitel: chapterNumbers.length > 0,
    chapterNumbers,
  }
}

/**
 * Given kap. detection results, classify whether this is a known
 * keep-whole or split omnibus. Falls back to the registry classification.
 * The tier classification is a product decision (stored in the registry),
 * not auto-detected.
 */
export function classifyOmnibus(
  documentNumber: string,
  detected: { hasKapitel: boolean; chapterNumbers: number[] }
): { tier: AfsTier; registryMatch: boolean } {
  const doc = getAfsDocument(documentNumber)

  if (!doc) {
    // Unknown document — use detection heuristic
    return {
      tier: detected.hasKapitel ? 'KEEP_WHOLE' : 'STANDALONE',
      registryMatch: false,
    }
  }

  // Registry is the source of truth for tier classification
  return {
    tier: doc.tier,
    registryMatch: true,
  }
}

// ============================================================================
// Metadata Builders (for LegalDocument.metadata field)
// ============================================================================

export interface AfsStandaloneMetadata {
  source: 'av.se'
  method: 'html-scraping'
  tier: 'STANDALONE' | 'KEEP_WHOLE'
  consolidated_through: string | null
  forfattningshistorik_url: string
}

export interface AfsSplitParentMetadata {
  source: 'av.se'
  method: 'html-scraping'
  tier: 'SPLIT_PARENT'
  is_omnibus: true
  split_strategy: 'chapter'
  chapter_count: number
  chapter_documents: string[]
  has_avdelningar: boolean
  consolidated_through: string | null
  forfattningshistorik_url: string
}

export interface AfsSplitChapterMetadata {
  source: 'av.se'
  method: 'html-scraping'
  tier: 'SPLIT_CHAPTER'
  parent_afs: string
  chapter_number: number
  chapter_title: string
  consolidated_through: string | null
}

export type AfsMetadata =
  | AfsStandaloneMetadata
  | AfsSplitParentMetadata
  | AfsSplitChapterMetadata

/** Build metadata for standalone or keep-whole entries */
export function buildStandaloneMetadata(
  doc: AfsDocument,
  forfattningshistorikUrl: string
): AfsStandaloneMetadata {
  return {
    source: 'av.se',
    method: 'html-scraping',
    tier: doc.tier as 'STANDALONE' | 'KEEP_WHOLE',
    consolidated_through: doc.consolidatedThrough,
    forfattningshistorik_url: forfattningshistorikUrl,
  }
}

/** Build metadata for split parent entries */
export function buildParentMetadata(
  doc: AfsDocument,
  forfattningshistorikUrl: string
): AfsSplitParentMetadata {
  return {
    source: 'av.se',
    method: 'html-scraping',
    tier: 'SPLIT_PARENT',
    is_omnibus: true,
    split_strategy: 'chapter',
    chapter_count: doc.chapters.length,
    chapter_documents: doc.chapters.map((ch) =>
      formatChapterDocumentNumber(doc.documentNumber, ch.number)
    ),
    has_avdelningar: doc.hasAvdelningar,
    consolidated_through: doc.consolidatedThrough,
    forfattningshistorik_url: forfattningshistorikUrl,
  }
}

/** Build metadata for split chapter entries */
export function buildChapterMetadata(
  doc: AfsDocument,
  chapter: AfsChapter
): AfsSplitChapterMetadata {
  return {
    source: 'av.se',
    method: 'html-scraping',
    tier: 'SPLIT_CHAPTER',
    parent_afs: doc.documentNumber,
    chapter_number: chapter.number,
    chapter_title: chapter.title,
    consolidated_through: doc.consolidatedThrough,
  }
}

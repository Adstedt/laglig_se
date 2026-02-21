/**
 * Canonical JSON Schema for Legal Documents
 * Story 14.1, Task 5 (AC: 10-14)
 *
 * Hierarchical schema that all json_content in the legal_documents table
 * must conform to. Derived from canonical HTML via the single parser
 * in canonical-html-parser.ts.
 *
 * Naming follows Swedish legal terminology:
 * - Paragraf (§) = the numbered section (§ 1, § 2a, Artikel 1)
 * - Stycke = individual text block within a paragraf
 */

// ============================================================================
// Content Roles
// ============================================================================

export type ContentRole =
  | 'STYCKE'
  | 'LIST_ITEM'
  | 'ALLMANT_RAD'
  | 'PREAMBLE'
  | 'TABLE'
  | 'HEADING'
  | 'TRANSITION_PROVISION'
  | 'FOOTNOTE'

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType =
  | 'SFS_LAW'
  | 'SFS_AMENDMENT'
  | 'AGENCY_REGULATION'
  | 'EU_REGULATION'
  | 'EU_DIRECTIVE'

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Top-level document structure.
 *
 * Mutual exclusivity rule for divisions/chapters:
 * - With avdelningar: `divisions` is populated, `chapters` is `[]`
 * - Without avdelningar: `divisions` is `null`, `chapters` holds all data
 */
export interface CanonicalDocumentJson {
  schemaVersion: '1.0'
  documentType: DocumentType
  title: string | null
  documentNumber: string | null

  /** Avdelningar (divisions) — null when document has no avdelningar */
  divisions: CanonicalDivision[] | null

  /** Top-level chapters — empty when divisions is populated */
  chapters: CanonicalChapter[]

  /** Optional sections outside the main body */
  preamble: CanonicalPreamble | null
  transitionProvisions: CanonicalStycke[] | null
  appendices: CanonicalAppendix[] | null

  metadata: {
    sfsNumber: string | null
    baseLawSfs: string | null
    effectiveDate: string | null
  }
}

/**
 * Avdelning (division) — groups chapters in 3-level hierarchy docs.
 */
export interface CanonicalDivision {
  /** Arabic number derived from heading (e.g., "1", "2") */
  number: string
  title: string | null
  chapters: CanonicalChapter[]
}

/**
 * Chapter (kapitel).
 * For flat docs with no chapters, a single implicit chapter with number=null
 * wraps all paragrafer.
 */
export interface CanonicalChapter {
  /** Chapter number, e.g., "1", "2". Null for implicit chapter in flat docs. */
  number: string | null
  title: string | null
  paragrafer: CanonicalParagraf[]
}

/**
 * Paragraf (§ / Artikel).
 * Represents a single § in Swedish law or an Artikel in EU regulations.
 */
export interface CanonicalParagraf {
  /** Paragraf identifier: "1", "2a", "15b", "art1" */
  number: string
  /** Paragraf heading/subtitle if present */
  heading: string | null
  /** Concatenated plain text of all stycken (for chunking/search) */
  content: string
  /** Amendment reference, e.g. "Lag (2022:1109)" */
  amendedBy: string | null
  stycken: CanonicalStycke[]
}

/**
 * Stycke — individual text block within a paragraf.
 */
export interface CanonicalStycke {
  /** Stycke number (1, 2, 3...), null for non-numbered content */
  number: number | null
  /** Plain text content */
  text: string
  /** Content role classification */
  role: ContentRole
  /** Raw HTML for rendering (optional, included for complex content) */
  htmlContent?: string
}

/**
 * Preamble — special zone (EU docs, some agency regs).
 * Content is opaque: stored as raw HTML, not decomposed into paragrafer.
 */
export interface CanonicalPreamble {
  /** Raw HTML content of the preamble */
  htmlContent: string
  /** Plain text extraction for search */
  text: string
}

/**
 * Appendix (Bilaga).
 */
export interface CanonicalAppendix {
  /** Appendix title (e.g., "Bilaga 1 Arbetstagare med uppgifter") */
  title: string | null
  /** Raw HTML content */
  htmlContent: string
  /** Plain text extraction for search */
  text: string
}

/**
 * SFS Document Classification
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * Classifies SFS documents by type (lag, förordning, etc.) and category
 * (new, amendment, repeal) based on the document title.
 */

/**
 * Document type classification
 */
export type SfsDocumentType = 'lag' | 'förordning' | 'kungörelse' | 'other'

/**
 * Document category classification
 */
export type SfsDocumentCategory = 'new' | 'amendment' | 'repeal'

/**
 * Full classification result
 */
export interface SfsClassification {
  /** Type of document: lag, förordning, kungörelse, or other */
  type: SfsDocumentType
  /** Category: new law, amendment, or repeal */
  category: SfsDocumentCategory
  /** For amendments/repeals: type of the target document */
  targetType: SfsDocumentType | null
  /** For amendments/repeals: SFS number of the target document (e.g., "1977:1160") */
  targetSfs: string | null
  /** Confidence score 0.0 - 1.0 */
  confidence: number
}

// Patterns for detecting amendments
const AMENDMENT_PATTERNS = [
  /om ändring i/i,
  /om ändringar i/i,
  /om ändrad lydelse av/i,
]

// Patterns for detecting repeals
const REPEAL_PATTERNS = [/om upphävande av/i, /om upphörande av/i, /upphävs/i]

// Pattern to extract ALL SFS numbers from title
// We need to find the SECOND one (the target) for amendments/repeals
const ALL_SFS_PATTERN = /\((?:SFS\s*)?(\d{4}:\d+)\)/gi

/**
 * Extract target SFS number from title for amendments/repeals
 * Returns the SECOND SFS number found (the target document)
 */
function extractTargetSfs(title: string): string | null {
  const matches = [...title.matchAll(ALL_SFS_PATTERN)]
  // For amendments, the first SFS is the amendment document itself,
  // the second is the target document being amended
  if (matches.length >= 2) {
    const targetMatch = matches[1]
    if (targetMatch && targetMatch[1]) {
      return targetMatch[1]
    }
  }
  return null
}

/**
 * Detect document type from title
 * For amendments, we look at the type of the AMENDMENT document (start of title)
 * not the target document
 */
function detectDocumentType(title: string): {
  type: SfsDocumentType
  confidence: number
} {
  const lowerTitle = title.toLowerCase()

  // For amendments/repeals, focus on the document type at the START of the title
  // "Lag (2025:50) om ändring i förordningen..." -> the document is a Lag
  // Split at "om ändring" or "om upphävande" to get document's own type
  const amendmentIndex = lowerTitle.indexOf('om ändring')
  const repealIndex = lowerTitle.indexOf('om upphävande')
  const splitIndex = Math.min(
    amendmentIndex >= 0 ? amendmentIndex : Infinity,
    repealIndex >= 0 ? repealIndex : Infinity
  )

  // Use only the prefix for type detection if this is an amendment/repeal
  const typeCheckTitle =
    splitIndex < Infinity ? lowerTitle.substring(0, splitIndex) : lowerTitle

  // Check for specific document types with their patterns
  // Order matters: check start of title first for clearer matches

  // Check if title STARTS with specific types (most reliable)
  if (typeCheckTitle.startsWith('lag (') || typeCheckTitle.startsWith('lag ')) {
    return { type: 'lag', confidence: 0.95 }
  }

  if (typeCheckTitle.startsWith('förordning')) {
    return { type: 'förordning', confidence: 0.95 }
  }

  if (typeCheckTitle.startsWith('kungörelse')) {
    return { type: 'kungörelse', confidence: 0.95 }
  }

  // Check for "balk" pattern - e.g., "Brottsbalk (1962:700)"
  if (/balk\s*\(/i.test(typeCheckTitle)) {
    return { type: 'lag', confidence: 0.95 }
  }

  // Check content for type indicators
  if (typeCheckTitle.includes('kungörelse')) {
    return { type: 'kungörelse', confidence: 0.95 }
  }

  if (typeCheckTitle.includes('förordning')) {
    return { type: 'förordning', confidence: 0.95 }
  }

  if (
    typeCheckTitle.includes('lag ') ||
    typeCheckTitle.includes('lagen ') ||
    typeCheckTitle.includes('lagen)') ||
    typeCheckTitle.includes('lag)') ||
    typeCheckTitle.includes('balken')
  ) {
    return { type: 'lag', confidence: 0.95 }
  }

  // Fallback: check for common law-related words
  if (
    lowerTitle.includes('stadga') ||
    lowerTitle.includes('instruktion') ||
    lowerTitle.includes('reglemente')
  ) {
    return { type: 'förordning', confidence: 0.7 }
  }

  return { type: 'other', confidence: 0.5 }
}

/**
 * Detect target document type from an amendment/repeal title
 * This looks at what type of document is being modified
 */
function detectTargetType(title: string): SfsDocumentType | null {
  const lowerTitle = title.toLowerCase()

  // Look for "i förordningen", "i lagen", etc.
  if (
    lowerTitle.includes('i förordningen') ||
    lowerTitle.includes('förordningen (')
  ) {
    return 'förordning'
  }

  if (
    lowerTitle.includes('i lagen') ||
    lowerTitle.includes('lagen (') ||
    lowerTitle.includes('i balken') ||
    lowerTitle.includes('balken (')
  ) {
    return 'lag'
  }

  if (
    lowerTitle.includes('i kungörelsen') ||
    lowerTitle.includes('kungörelsen (')
  ) {
    return 'kungörelse'
  }

  return null
}

/**
 * Detect document category (new, amendment, repeal)
 */
function detectCategory(title: string): {
  category: SfsDocumentCategory
  confidence: number
} {
  // Check for repeal patterns first (more specific)
  for (const pattern of REPEAL_PATTERNS) {
    if (pattern.test(title)) {
      return { category: 'repeal', confidence: 0.95 }
    }
  }

  // Check for amendment patterns
  for (const pattern of AMENDMENT_PATTERNS) {
    if (pattern.test(title)) {
      return { category: 'amendment', confidence: 0.95 }
    }
  }

  // Default to new document
  return { category: 'new', confidence: 0.9 }
}

/**
 * Classify an SFS document based on its title
 *
 * @param title - The document title (e.g., "Lag (2025:123) om ändring i arbetsmiljölagen (1977:1160)")
 * @returns Classification result with type, category, target info, and confidence
 *
 * @example
 * // New law
 * classifyLawType("Arbetsmiljölag (1977:1160)")
 * // => { type: 'lag', category: 'new', targetType: null, targetSfs: null, confidence: 0.9 }
 *
 * @example
 * // Amendment to existing law
 * classifyLawType("Lag (2025:1581) om ändring i arbetsmiljölagen (1977:1160)")
 * // => { type: 'lag', category: 'amendment', targetType: 'lag', targetSfs: '1977:1160', confidence: 0.95 }
 *
 * @example
 * // Förordning
 * classifyLawType("Förordning (2024:456) om miljöskydd")
 * // => { type: 'förordning', category: 'new', targetType: null, targetSfs: null, confidence: 0.9 }
 */
export function classifyLawType(title: string): SfsClassification {
  if (!title || typeof title !== 'string') {
    return {
      type: 'other',
      category: 'new',
      targetType: null,
      targetSfs: null,
      confidence: 0,
    }
  }

  // Detect category first
  const { category, confidence: categoryConfidence } = detectCategory(title)

  // Detect document type
  const { type, confidence: typeConfidence } = detectDocumentType(title)

  // For amendments/repeals, extract target information
  let targetType: SfsDocumentType | null = null
  let targetSfs: string | null = null

  if (category === 'amendment' || category === 'repeal') {
    targetSfs = extractTargetSfs(title)
    targetType = detectTargetType(title)
  }

  // Calculate overall confidence
  const confidence = Math.min(categoryConfidence, typeConfidence)

  return {
    type,
    category,
    targetType,
    targetSfs,
    confidence,
  }
}

/**
 * Extract the base SFS number from a title
 * Used to find the SFS number of the document itself
 *
 * @example
 * extractSfsFromTitle("Lag (2025:1581) om ändring...")
 * // => "2025:1581"
 */
export function extractSfsFromTitle(title: string): string | null {
  // Match the first SFS number in the title (the document's own number)
  const match = title.match(/\((?:SFS\s*)?(\d{4}:\d+)\)/)
  return match && match[1] ? match[1] : null
}

/**
 * Build metadata object for storing classification in LegalDocument
 */
export interface ClassificationMetadata {
  lawType: SfsDocumentType
  documentCategory: SfsDocumentCategory
  baseLawSfs: string | null
  baseLawType: SfsDocumentType | null
  classificationConfidence: number
}

/**
 * Convert classification to metadata format for storage
 */
export function classificationToMetadata(
  classification: SfsClassification
): ClassificationMetadata {
  return {
    lawType: classification.type,
    documentCategory: classification.category,
    baseLawSfs: classification.targetSfs,
    baseLawType: classification.targetType,
    classificationConfidence: classification.confidence,
  }
}

/**
 * SFS Document Utilities
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * This module provides utilities for:
 * - Document classification (lag vs förordning, new vs amendment)
 * - PDF URL construction
 * - PDF fetching and storage
 */

// Classification
export {
  classifyLawType,
  extractSfsFromTitle,
  classificationToMetadata,
  type SfsClassification,
  type SfsDocumentType,
  type SfsDocumentCategory,
  type ClassificationMetadata,
} from './classify'

// PDF URL construction
export {
  constructPdfUrls,
  parseSfsNumber,
  extractYearMonth,
  padSfsNumber,
  constructStoragePath,
  extractSfsFromStoragePath,
  type SfsPdfUrls,
} from './pdf-urls'

// PDF fetching and storage
export {
  fetchAndStorePdf,
  createErrorMetadata,
  shouldRetryPdf,
  resetRateLimiter,
  type PdfMetadata,
  type FetchPdfResult,
} from './pdf-fetcher'

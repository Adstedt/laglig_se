/**
 * Sync Module
 *
 * Provides utilities for syncing legal documents from external APIs
 * and tracking changes over time.
 *
 * Story 2.11: Content Change Detection & Daily Sync
 */

// Version archiving
export {
  archiveDocumentVersion,
  getVersionHistory,
  getVersion,
  getLatestVersion,
  countVersions,
  createInitialVersion,
} from './version-archive'

// Change detection
export {
  computeDiff,
  generateUnifiedDiff,
  hasSubstantiveChanges,
  detectChanges,
  createNewLawEvent,
  createRepealEvent,
  createNewRulingEvent,
  getPendingAiSummaries,
  getDocumentChanges,
  getChangesByDateRange,
} from './change-detection'

// Section parsing
export {
  parseUndertitel,
  extractSectionAmendments,
  findChangedSections,
  extractAllSfsReferences,
  parseTransitionalProvisions,
  groupAmendmentsBySfs,
} from './section-parser'

// Amendment creation
export {
  createAmendmentFromChange,
  extractAllAmendments,
  countAmendments,
  getAmendments,
  linkAmendmentToVersion,
} from './amendment-creator'

// AI Summary Queue
export {
  getPendingChangeSummaries,
  getPendingAmendmentSummaries,
  saveChangeSummary,
  saveAmendmentSummary,
  countPendingSummaries,
  generateAmendmentSummaryPrompt,
  generateRepealSummaryPrompt,
  processPendingSummaries,
} from './ai-summary-queue'

// Re-export types
export type { SectionAmendment, ParsedAmendments } from './section-parser'
export type { DiffResult, DetectChangesParams } from './change-detection'
export type { ArchiveVersionParams } from './version-archive'
export type { CreateAmendmentParams } from './amendment-creator'

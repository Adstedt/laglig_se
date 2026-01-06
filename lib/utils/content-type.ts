/**
 * Story 4.11: Content Type Utilities
 * Swedish display names, badge colors, icons, and grouping for legal document types
 */

import type { ContentType } from '@prisma/client'
import {
  Scale,
  FileEdit,
  Gavel,
  Globe,
  type LucideIcon,
} from 'lucide-react'

// ============================================================================
// LABELS - Swedish display names
// ============================================================================

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SFS_LAW: 'Lag',
  SFS_AMENDMENT: 'Ändring',
  COURT_CASE_AD: 'AD',
  COURT_CASE_HD: 'HD',
  COURT_CASE_HOVR: 'HovR',
  COURT_CASE_HFD: 'HFD',
  COURT_CASE_MOD: 'MÖD',
  COURT_CASE_MIG: 'MIG',
  EU_REGULATION: 'EU-förordning',
  EU_DIRECTIVE: 'EU-direktiv',
}

const CONTENT_TYPE_FULL_LABELS: Record<ContentType, string> = {
  SFS_LAW: 'Lag',
  SFS_AMENDMENT: 'Ändringsförfattning',
  COURT_CASE_AD: 'Arbetsdomstolen',
  COURT_CASE_HD: 'Högsta domstolen',
  COURT_CASE_HOVR: 'Hovrätt',
  COURT_CASE_HFD: 'Högsta förvaltningsdomstolen',
  COURT_CASE_MOD: 'Mark- och miljööverdomstolen',
  COURT_CASE_MIG: 'Migrationsöverdomstolen',
  EU_REGULATION: 'EU-förordning',
  EU_DIRECTIVE: 'EU-direktiv',
}

export function getContentTypeLabel(type: ContentType): string {
  return CONTENT_TYPE_LABELS[type] ?? type
}

export function getContentTypeFullLabel(type: ContentType): string {
  return CONTENT_TYPE_FULL_LABELS[type] ?? type
}

// ============================================================================
// BADGE COLORS - Tailwind classes
// ============================================================================

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  SFS_LAW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SFS_AMENDMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  COURT_CASE_AD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COURT_CASE_HD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COURT_CASE_HOVR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COURT_CASE_HFD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COURT_CASE_MOD: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  COURT_CASE_MIG: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  EU_REGULATION: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EU_DIRECTIVE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

export function getContentTypeBadgeColor(type: ContentType): string {
  return CONTENT_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// ============================================================================
// ICONS - Lucide icon components
// ============================================================================

const CONTENT_TYPE_ICONS: Record<ContentType, LucideIcon> = {
  SFS_LAW: Scale,
  SFS_AMENDMENT: FileEdit,
  COURT_CASE_AD: Gavel,
  COURT_CASE_HD: Gavel,
  COURT_CASE_HOVR: Gavel,
  COURT_CASE_HFD: Gavel,
  COURT_CASE_MOD: Gavel,
  COURT_CASE_MIG: Gavel,
  EU_REGULATION: Globe,
  EU_DIRECTIVE: Globe,
}

export function getContentTypeIcon(type: ContentType): LucideIcon {
  return CONTENT_TYPE_ICONS[type] ?? Scale
}

// ============================================================================
// TYPE CHECKS
// ============================================================================

const COURT_CASE_TYPES: ContentType[] = [
  'COURT_CASE_AD',
  'COURT_CASE_HD',
  'COURT_CASE_HOVR',
  'COURT_CASE_HFD',
  'COURT_CASE_MOD',
  'COURT_CASE_MIG',
]

const EU_DOCUMENT_TYPES: ContentType[] = [
  'EU_REGULATION',
  'EU_DIRECTIVE',
]

export function isCourtCase(type: ContentType): boolean {
  return COURT_CASE_TYPES.includes(type)
}

export function isEuDocument(type: ContentType): boolean {
  return EU_DOCUMENT_TYPES.includes(type)
}

export function isSfsDocument(type: ContentType): boolean {
  return type === 'SFS_LAW' || type === 'SFS_AMENDMENT'
}

// ============================================================================
// GROUPING - For filter UI
// ============================================================================

export interface ContentTypeGroup {
  id: string
  label: string
  labelPlural: string
  types: ContentType[]
}

export const CONTENT_TYPE_GROUPS: ContentTypeGroup[] = [
  {
    id: 'laws',
    label: 'Lag',
    labelPlural: 'Lagar',
    types: ['SFS_LAW'],
  },
  {
    id: 'amendments',
    label: 'Ändring',
    labelPlural: 'Ändringar',
    types: ['SFS_AMENDMENT'],
  },
  {
    id: 'courtCases',
    label: 'Rättsfall',
    labelPlural: 'Rättsfall',
    types: COURT_CASE_TYPES,
  },
  {
    id: 'euDocuments',
    label: 'EU-dokument',
    labelPlural: 'EU-dokument',
    types: EU_DOCUMENT_TYPES,
  },
]

/**
 * Group content types into logical categories
 * Used for filter chips in the UI
 */
export function groupContentTypes(types: ContentType[]): ContentTypeGroup[] {
  return CONTENT_TYPE_GROUPS.filter(group =>
    group.types.some(t => types.includes(t))
  )
}

/**
 * Get all content types for a group ID
 */
export function getContentTypesForGroup(groupId: string): ContentType[] {
  const group = CONTENT_TYPE_GROUPS.find(g => g.id === groupId)
  return group?.types ?? []
}

/**
 * Get group for a content type
 */
export function getGroupForContentType(type: ContentType): ContentTypeGroup | undefined {
  return CONTENT_TYPE_GROUPS.find(group => group.types.includes(type))
}

// ============================================================================
// ALL CONTENT TYPES - For iteration
// ============================================================================

export const ALL_CONTENT_TYPES: ContentType[] = [
  'SFS_LAW',
  'SFS_AMENDMENT',
  ...COURT_CASE_TYPES,
  ...EU_DOCUMENT_TYPES,
]

// ============================================================================
// URL HELPERS - Generate document URLs based on type
// ============================================================================

export function getDocumentUrl(
  type: ContentType,
  slug: string,
  isWorkspace: boolean = false
): string {
  const prefix = isWorkspace ? '/browse' : ''

  if (type === 'SFS_LAW') {
    return `${prefix}/lagar/${slug}`
  }

  if (type === 'SFS_AMENDMENT') {
    return `${prefix}/lagar/andringar/${slug}`
  }

  if (isCourtCase(type)) {
    // Extract court code from content type (e.g., COURT_CASE_HD -> hd)
    const courtCode = type.replace('COURT_CASE_', '').toLowerCase()
    return `${prefix}/rattsfall/${courtCode}/${slug}`
  }

  if (isEuDocument(type)) {
    const euType = type === 'EU_REGULATION' ? 'forordning' : 'direktiv'
    return `${prefix}/eu/${euType}/${slug}`
  }

  // Fallback
  return `${prefix}/lagar/${slug}`
}

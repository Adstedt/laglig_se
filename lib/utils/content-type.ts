/**
 * Story 4.11: Content Type Utilities
 * Swedish display names, badge colors, icons, and grouping for legal document types
 */

import type { ContentType } from '@prisma/client'
import { Scale, FileEdit, Globe, BookOpen, type LucideIcon } from 'lucide-react'

// ============================================================================
// LABELS - Swedish display names
// ============================================================================

const CONTENT_TYPE_LABELS: Partial<Record<ContentType, string>> = {
  SFS_LAW: 'Lag',
  SFS_AMENDMENT: 'Ändring',
  EU_REGULATION: 'EU-förordning',
  EU_DIRECTIVE: 'EU-direktiv',
  AGENCY_REGULATION: 'Myndighetsföreskrift',
}

const CONTENT_TYPE_FULL_LABELS: Partial<Record<ContentType, string>> = {
  SFS_LAW: 'Lag',
  SFS_AMENDMENT: 'Ändringsförfattning',
  EU_REGULATION: 'EU-förordning',
  EU_DIRECTIVE: 'EU-direktiv',
  AGENCY_REGULATION: 'Myndighetsföreskrift',
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

const CONTENT_TYPE_COLORS: Partial<Record<ContentType, string>> = {
  SFS_LAW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SFS_AMENDMENT:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  EU_REGULATION:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EU_DIRECTIVE:
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  AGENCY_REGULATION:
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

export function getContentTypeBadgeColor(type: ContentType): string {
  return (
    CONTENT_TYPE_COLORS[type] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  )
}

// ============================================================================
// ICONS - Lucide icon components
// ============================================================================

const CONTENT_TYPE_ICONS: Partial<Record<ContentType, LucideIcon>> = {
  SFS_LAW: Scale,
  SFS_AMENDMENT: FileEdit,
  EU_REGULATION: Globe,
  EU_DIRECTIVE: Globe,
  AGENCY_REGULATION: BookOpen,
}

export function getContentTypeIcon(type: ContentType): LucideIcon {
  return CONTENT_TYPE_ICONS[type] ?? Scale
}

// ============================================================================
// TYPE CHECKS
// ============================================================================

const EU_DOCUMENT_TYPES: ContentType[] = ['EU_REGULATION', 'EU_DIRECTIVE']

export function isEuDocument(type: ContentType): boolean {
  return EU_DOCUMENT_TYPES.includes(type)
}

export function isSfsDocument(type: ContentType): boolean {
  return type === 'SFS_LAW' || type === 'SFS_AMENDMENT'
}

export function isAgencyRegulation(type: ContentType): boolean {
  return type === 'AGENCY_REGULATION'
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
    id: 'euDocuments',
    label: 'EU-dokument',
    labelPlural: 'EU-dokument',
    types: EU_DOCUMENT_TYPES,
  },
  {
    id: 'agencyRegulations',
    label: 'Myndighetsföreskrift',
    labelPlural: 'Myndighetsföreskrifter',
    types: ['AGENCY_REGULATION'],
  },
]

/**
 * Group content types into logical categories
 * Used for filter chips in the UI
 */
export function groupContentTypes(types: ContentType[]): ContentTypeGroup[] {
  return CONTENT_TYPE_GROUPS.filter((group) =>
    group.types.some((t) => types.includes(t))
  )
}

/**
 * Get all content types for a group ID
 */
export function getContentTypesForGroup(groupId: string): ContentType[] {
  const group = CONTENT_TYPE_GROUPS.find((g) => g.id === groupId)
  return group?.types ?? []
}

/**
 * Get group for a content type
 */
export function getGroupForContentType(
  type: ContentType
): ContentTypeGroup | undefined {
  return CONTENT_TYPE_GROUPS.find((group) => group.types.includes(type))
}

// ============================================================================
// ALL CONTENT TYPES - For iteration
// ============================================================================

export const ALL_CONTENT_TYPES: ContentType[] = [
  'SFS_LAW',
  'SFS_AMENDMENT',
  ...EU_DOCUMENT_TYPES,
  'AGENCY_REGULATION',
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

  if (isEuDocument(type)) {
    const euType = type === 'EU_REGULATION' ? 'forordning' : 'direktiv'
    return `${prefix}/eu/${euType}/${slug}`
  }

  if (isAgencyRegulation(type)) {
    return `${prefix}/foreskrifter/${slug}`
  }

  // Fallback
  return `${prefix}/lagar/${slug}`
}

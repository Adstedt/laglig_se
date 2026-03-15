import {
  FileText,
  Landmark,
  FilePenLine,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

export type DocumentTheme = {
  icon: LucideIcon
  label: string
  badge: string
  accent: string
  accentLight: string
  border: string
  href: string
}

export const DOCUMENT_THEMES: Record<string, DocumentTheme> = {
  // SFS Laws - Amber
  SFS_LAW: {
    icon: FileText,
    label: 'Lag',
    badge:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    accent: 'text-amber-700 dark:text-amber-400',
    accentLight: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    href: '/lagar',
  },

  // SFS Amendments - Orange (distinct from base laws)
  SFS_AMENDMENT: {
    icon: FilePenLine,
    label: 'Ändringsförfattning',
    badge:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    accent: 'text-orange-700 dark:text-orange-400',
    accentLight: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    href: '/lagar/andringar',
  },

  // EU Law - Purple
  EU_REGULATION: {
    icon: Landmark,
    label: 'EU-förordning',
    badge:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    accent: 'text-purple-700 dark:text-purple-400',
    accentLight: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    href: '/eu/forordningar',
  },
  EU_DIRECTIVE: {
    icon: Landmark,
    label: 'EU-direktiv',
    badge:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    accent: 'text-purple-700 dark:text-purple-400',
    accentLight: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    href: '/eu/direktiv',
  },
  // Agency Regulations - Teal
  AGENCY_REGULATION: {
    icon: BookOpen,
    label: 'Myndighetsföreskrift',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
    accent: 'text-teal-700 dark:text-teal-400',
    accentLight: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    href: '/foreskrifter',
  },
}

export function getDocumentTheme(contentType: string): DocumentTheme {
  return (
    DOCUMENT_THEMES[contentType] ?? {
      icon: FileText,
      label: contentType,
      badge: 'bg-muted text-muted-foreground',
      accent: 'text-muted-foreground',
      accentLight: 'bg-muted/50',
      border: 'border-border',
      href: '/lagar',
    }
  )
}

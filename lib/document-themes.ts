import { FileText, Scale, Landmark, type LucideIcon } from 'lucide-react'

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

  // Court cases - Blue
  COURT_CASE_AD: {
    icon: Scale,
    label: 'Arbetsdomstolen',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/ad',
  },
  COURT_CASE_HD: {
    icon: Scale,
    label: 'Högsta domstolen',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/hd',
  },
  COURT_CASE_HFD: {
    icon: Scale,
    label: 'Högsta förvaltningsdomstolen',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/hfd',
  },
  COURT_CASE_HOVR: {
    icon: Scale,
    label: 'Hovrätten',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/hovr',
  },
  COURT_CASE_MOD: {
    icon: Scale,
    label: 'Mark- och miljööverdomstolen',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/mod',
  },
  COURT_CASE_MIG: {
    icon: Scale,
    label: 'Migrationsöverdomstolen',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    accent: 'text-blue-700 dark:text-blue-400',
    accentLight: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    href: '/rattsfall/mig',
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

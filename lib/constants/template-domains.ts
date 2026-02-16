import type { LucideIcon } from 'lucide-react'
import { Scale, ScrollText, FileCheck, Globe, BookOpen } from 'lucide-react'

/** Domain → display name mapping */
export const DOMAIN_LABELS: Record<string, string> = {
  arbetsmiljo: 'Arbetsmiljö',
  miljo: 'Miljö',
  gdpr: 'GDPR',
  brandskydd: 'Brandskydd',
  livsmedel: 'Livsmedel',
}

/** Domain → badge color classes (with dark mode) */
export const DOMAIN_COLORS: Record<string, string> = {
  arbetsmiljo:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  miljo:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  gdpr: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  brandskydd:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  livsmedel:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
}

export const DEFAULT_DOMAIN_COLOR =
  'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800'

/** Domain → top-accent bar background color */
export const DOMAIN_ACCENT_COLORS: Record<string, string> = {
  arbetsmiljo: 'bg-amber-400 dark:bg-amber-500',
  miljo: 'bg-emerald-400 dark:bg-emerald-500',
  gdpr: 'bg-blue-400 dark:bg-blue-500',
  brandskydd: 'bg-red-400 dark:bg-red-500',
  livsmedel: 'bg-purple-400 dark:bg-purple-500',
}

export const DEFAULT_ACCENT_COLOR = 'bg-gray-400 dark:bg-gray-500'

/** Source type → Swedish display label */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  lag: 'Lag',
  forordning: 'Förordning',
  foreskrift: 'Föreskrift',
  'eu-forordning': 'EU-förordning',
  'allmanna-rad': 'Allmänna råd',
}

/** Source type → Lucide icon component */
export const SOURCE_TYPE_ICONS: Record<string, LucideIcon> = {
  lag: Scale,
  forordning: ScrollText,
  foreskrift: FileCheck,
  'eu-forordning': Globe,
  'allmanna-rad': BookOpen,
}

/** Source type → outline badge color classes (with dark mode) */
export const SOURCE_TYPE_COLORS: Record<string, string> = {
  lag: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  forordning:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800',
  foreskrift:
    'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  'eu-forordning':
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
  'allmanna-rad':
    'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
}

/** Source type → filled icon badge colors matching law list table pattern */
export const SOURCE_TYPE_ICON_BADGE_COLORS: Record<string, string> = {
  lag: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  forordning:
    'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  foreskrift:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'eu-forordning':
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'allmanna-rad':
    'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

export const DEFAULT_ICON_BADGE_COLOR =
  'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'

'use client'

/**
 * Story 14.11: Context Cards for Hem page
 * Displays clickable compliance status cards above the chat input in home state.
 * Each card is a self-contained sentence — the number is always in context.
 * Cards pull from getDashboardData() and clicking sends a relevant prompt.
 */

import {
  ShieldCheck,
  FileWarning,
  AlertTriangle,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface DashboardCardData {
  complianceStats: { total: number; compliant: number } | null
  taskCounts: { overdue: number; thisWeek: number; myTasks: number } | null
  pendingAmendments?: number
}

interface ContextCardsProps {
  data: DashboardCardData | null
  isLoading: boolean
  onCardClick: (_prompt: string) => void
}

interface CardConfig {
  id: string
  /** Primary sentence — always includes the number in context */
  getTitle: (_data: DashboardCardData) => string
  /** Secondary line — contextual completion or positive confirmation */
  getSubtitle: (_data: DashboardCardData) => string | null
  /** Shown when data is null (not yet loaded) */
  fallbackTitle: string
  icon: React.ComponentType<{ className?: string }>
  prompt: string
  colorClass: string
  /** Optional visual element below text (e.g. progress bar) */
  renderExtra?: (_data: DashboardCardData) => React.ReactNode
  /** Whether this card should pulse to signal urgency */
  isUrgent?: (_data: DashboardCardData) => boolean
}

const CARDS: CardConfig[] = [
  {
    id: 'compliance',
    getTitle: (data) => {
      if (!data.complianceStats || data.complianceStats.total === 0)
        return 'Ingen efterlevnadsdata'
      const { compliant, total } = data.complianceStats
      if (compliant === total) return `Alla ${total} lagar uppfyllda`
      return `${compliant} av ${total} lagar uppfyllda`
    },
    getSubtitle: (data) => {
      if (!data.complianceStats || data.complianceStats.total === 0) return null
      const { compliant, total } = data.complianceStats
      if (compliant === total) return 'Full efterlevnad'
      return 'Visa efterlevnadsöversikt'
    },
    fallbackTitle: 'Efterlevnad',
    icon: ShieldCheck,
    prompt: 'Visa en översikt av min efterlevnad',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    renderExtra: (data) => {
      if (!data.complianceStats || data.complianceStats.total === 0) return null
      const pct = Math.round(
        (data.complianceStats.compliant / data.complianceStats.total) * 100
      )
      const barColor =
        pct < 33 ? 'bg-red-500' : pct < 67 ? 'bg-amber-500' : 'bg-emerald-500'
      return (
        <div
          className="mt-2 h-1.5 w-full rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )
    },
  },
  {
    id: 'amendments',
    getTitle: (data) => {
      if (data.pendingAmendments === undefined) return 'Lagändringar'
      if (data.pendingAmendments === 0) return 'Inga nya lagändringar'
      return data.pendingAmendments === 1
        ? '1 ny lagändring'
        : `${data.pendingAmendments} nya lagändringar`
    },
    getSubtitle: (data) => {
      if (data.pendingAmendments === undefined) return null
      return data.pendingAmendments > 0 ? 'att granska' : 'Allt uppdaterat'
    },
    fallbackTitle: 'Lagändringar',
    icon: FileWarning,
    prompt: 'Visa mina väntande ändringar',
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'overdue',
    getTitle: (data) => {
      if (!data.taskCounts) return 'Förfallna uppgifter'
      if (data.taskCounts.overdue === 0) return 'Inga förfallna uppgifter'
      return data.taskCounts.overdue === 1
        ? '1 förfallen uppgift'
        : `${data.taskCounts.overdue} förfallna uppgifter`
    },
    getSubtitle: (data) => {
      if (!data.taskCounts) return null
      return data.taskCounts.overdue > 0
        ? 'Kräver din åtgärd'
        : 'Allt i ordning'
    },
    fallbackTitle: 'Förfallna uppgifter',
    icon: AlertTriangle,
    prompt: 'Vilka uppgifter är förfallna?',
    colorClass: 'text-red-600 dark:text-red-400',
    isUrgent: (data) => !!data.taskCounts && data.taskCounts.overdue > 0,
  },
  {
    id: 'thisweek',
    getTitle: (data) => {
      if (!data.taskCounts) return 'Denna vecka'
      if (data.taskCounts.thisWeek === 0) return 'Inget planerat denna vecka'
      return data.taskCounts.thisWeek === 1
        ? '1 uppgift denna vecka'
        : `${data.taskCounts.thisWeek} uppgifter denna vecka`
    },
    getSubtitle: (data) => {
      if (!data.taskCounts) return null
      return data.taskCounts.thisWeek > 0 ? 'Visa veckans plan' : null
    },
    fallbackTitle: 'Denna vecka',
    icon: ListChecks,
    prompt: 'Vad behöver jag göra denna vecka?',
    colorClass: 'text-blue-600 dark:text-blue-400',
  },
]

export function ContextCards({
  data,
  isLoading,
  onCardClick,
}: ContextCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {CARDS.map((card) => {
        const Icon = card.icon
        const title = data ? card.getTitle(data) : card.fallbackTitle
        const subtitle =
          data && card.getSubtitle ? card.getSubtitle(data) : null
        const extra = data && card.renderExtra ? card.renderExtra(data) : null
        const urgent = data && card.isUrgent ? card.isUrgent(data) : false

        return (
          <button
            key={card.id}
            onClick={() => onCardClick(card.prompt)}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left',
              'transition-colors hover:bg-accent hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              urgent && 'motion-safe:animate-border-pulse'
            )}
            {...(urgent ? { 'data-testid': 'overdue-indicator' } : {})}
          >
            <div className="shrink-0 mt-0.5">
              <Icon className={cn('h-5 w-5', card.colorClass)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{title}</p>
              {subtitle && (
                <p className="text-xs text-foreground/50 mt-0.5">{subtitle}</p>
              )}
              {extra}
            </div>
          </button>
        )
      })}
    </div>
  )
}

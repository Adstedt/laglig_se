'use client'

/**
 * Story 14.11: Context Cards for Hem page
 * Displays clickable compliance summary cards above the chat input in home state.
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
  label: string
  getValue: (_data: DashboardCardData) => string
  icon: React.ComponentType<{ className?: string }>
  prompt: string
  colorClass: string
  /** Optional inline extra element rendered below the label (e.g. progress bar) */
  renderExtra?: (_data: DashboardCardData) => React.ReactNode
  /** Whether this card should show urgent styling (e.g. red left border) */
  isUrgent?: (_data: DashboardCardData) => boolean
}

const CARDS: CardConfig[] = [
  {
    label: 'Efterlevnad',
    getValue: (data) => {
      if (!data.complianceStats || data.complianceStats.total === 0) return '–'
      const pct = Math.round(
        (data.complianceStats.compliant / data.complianceStats.total) * 100
      )
      return `${pct}%`
    },
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
          className="mt-1.5 h-2 w-full rounded-full bg-muted"
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
    label: 'Ändringar',
    getValue: (data) => {
      if (data.pendingAmendments === undefined) return '–'
      return data.pendingAmendments > 0 ? `${data.pendingAmendments} nya` : '0'
    },
    icon: FileWarning,
    prompt: 'Visa mina väntande ändringar',
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Förfallna',
    getValue: (data) =>
      data.taskCounts ? String(data.taskCounts.overdue) : '–',
    icon: AlertTriangle,
    prompt: 'Vilka uppgifter är förfallna?',
    colorClass: 'text-red-600 dark:text-red-400',
    isUrgent: (data) => !!data.taskCounts && data.taskCounts.overdue > 0,
  },
  {
    label: 'Denna vecka',
    getValue: (data) =>
      data.taskCounts ? String(data.taskCounts.thisWeek) : '–',
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
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[84px] w-[160px] shrink-0 rounded-xl"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {CARDS.map((card) => {
        const Icon = card.icon
        const value = data ? card.getValue(data) : '–'
        const extra = data && card.renderExtra ? card.renderExtra(data) : null
        const urgent = data && card.isUrgent ? card.isUrgent(data) : false

        return (
          <button
            key={card.label}
            onClick={() => onCardClick(card.prompt)}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-xl border bg-card px-5 py-4',
              'transition-colors hover:bg-accent hover:border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              urgent && 'motion-safe:animate-border-pulse'
            )}
            {...(urgent ? { 'data-testid': 'overdue-indicator' } : {})}
          >
            <div className="shrink-0">
              <Icon className={cn('h-6 w-6', card.colorClass)} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xl font-semibold leading-tight">{value}</p>
              <p className="text-sm text-foreground/60">{card.label}</p>
              {extra}
            </div>
          </button>
        )
      })}
    </div>
  )
}

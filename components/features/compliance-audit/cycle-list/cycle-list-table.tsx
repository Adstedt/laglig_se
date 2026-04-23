'use client'

/**
 * Story 21.5.2 — Cycle list hub at `/laglistor/kontroller`.
 * Uses shadcn <Table> primitives to match the visual convention of
 * `/laglistor`, `/tasks`, and `/workspace/styrdokument`.
 *
 * Reuses CycleStatusBadge from its existing Story 21.5 location
 * (cycle-detail/cycle-status-badge.tsx). The architecture doc prescribed
 * it under cycle-list/, but Story 21.5 shipped it under cycle-detail/;
 * moving requires updating 5 imports + risks breaking Story 21.5's 40+
 * tests. Import-in-place is harmless — both surfaces consume the badge.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CycleStatusBadge } from '@/components/features/compliance-audit/cycle-detail/cycle-status-badge'
import type { CycleSummary } from '@/app/actions/compliance-audit-cycle'
import { ComplianceCycleStatus, AuditType } from '@prisma/client'

type FilterKey = 'aktiva' | 'slutforda' | 'forseglade' | 'arkiverade' | 'alla'

interface FilterDef {
  key: FilterKey
  label: string
  statuses: ComplianceCycleStatus[] | 'all'
}

const FILTERS: FilterDef[] = [
  {
    key: 'aktiva',
    label: 'Aktiva',
    statuses: [ComplianceCycleStatus.PLANERAD, ComplianceCycleStatus.PAGAENDE],
  },
  {
    key: 'slutforda',
    label: 'Slutförda',
    statuses: [ComplianceCycleStatus.AVSLUTAD],
  },
  {
    key: 'forseglade',
    label: 'Fastställda',
    statuses: [ComplianceCycleStatus.SEALED],
  },
  {
    key: 'arkiverade',
    label: 'Arkiverade',
    statuses: [ComplianceCycleStatus.ARKIVERAD],
  },
  { key: 'alla', label: 'Alla', statuses: 'all' },
]

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

interface CycleListTableProps {
  cycles: CycleSummary[]
  canCreate: boolean
}

export function CycleListTable({ cycles, canCreate }: CycleListTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('aktiva')

  const counts = useMemo(() => {
    const byStatus = cycles.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1
      return acc
    }, {})
    return {
      aktiva:
        (byStatus[ComplianceCycleStatus.PLANERAD] ?? 0) +
        (byStatus[ComplianceCycleStatus.PAGAENDE] ?? 0),
      slutforda: byStatus[ComplianceCycleStatus.AVSLUTAD] ?? 0,
      forseglade: byStatus[ComplianceCycleStatus.SEALED] ?? 0,
      arkiverade: byStatus[ComplianceCycleStatus.ARKIVERAD] ?? 0,
      alla: cycles.length,
    }
  }, [cycles])

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!

  const filtered = useMemo(() => {
    if (activeFilter.statuses === 'all') return cycles
    const set = new Set(activeFilter.statuses)
    return cycles.filter((c) => set.has(c.status))
  }, [cycles, activeFilter])

  return (
    <div className="space-y-6">
      {/* Header row — title + CTA (matches /laglistor + /tasks) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kontroller</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hantera pågående och tidigare efterlevnadskontroller.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/laglistor/kontroller/skapa">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Skapa kontroll
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Filter chips */}
      <div
        role="tablist"
        aria-label="Filtrera kontroller efter status"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const isActive = f.key === filter
          const count = counts[f.key]
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  isActive
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table — brand wrapper: rounded-md border overflow-x-auto.
          Matches /tasks list-tab, /workspace/styrdokument document-table,
          and Mina listor's compliance-detail-table. */}
      {filtered.length === 0 ? (
        <EmptyState filter={activeFilter.key} canCreate={canCreate} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead>Laglista</TableHead>
                <TableHead className="w-48">Period</TableHead>
                <TableHead>Ansvarig revisor</TableHead>
                <TableHead className="w-20 text-right">Dokument</TableHead>
                <TableHead className="w-32">Skapad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cycle) => (
                <CycleRow
                  key={cycle.id}
                  cycle={cycle}
                  onNavigate={() =>
                    router.push(`/laglistor/kontroller/${cycle.id}`)
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface CycleRowProps {
  cycle: CycleSummary
  onNavigate: () => void
}

function CycleRow({ cycle, onNavigate }: CycleRowProps) {
  const period =
    format(cycle.scheduledStart, 'd MMM yyyy', { locale: sv }) +
    '–' +
    format(cycle.scheduledEnd, 'd MMM yyyy', { locale: sv })
  const auditLabel = cycle.auditType === AuditType.INTERN ? 'Intern' : 'Extern'
  const href = `/laglistor/kontroller/${cycle.id}`

  return (
    <TableRow
      data-cycle-id={cycle.id}
      className="cursor-pointer"
      onClick={onNavigate}
    >
      <TableCell>
        {/* Anchor on the name cell gives keyboard access + right-click
            "open in new tab" for users; the row's onClick handles the
            convenience case for mouse. */}
        <Link
          href={href}
          className="block font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {cycle.name}
        </Link>
        <div className="text-xs text-muted-foreground">
          {auditLabel} revision
        </div>
      </TableCell>
      <TableCell>
        <CycleStatusBadge status={cycle.status} />
      </TableCell>
      <TableCell>
        <span className="truncate">{cycle.lawList.name}</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">{period}</span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">
              {initials(cycle.leadAuditor.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{cycle.leadAuditor.name ?? 'Okänd'}</span>
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {cycle.itemCount}
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">
          {format(cycle.createdAt, 'd MMM yyyy', { locale: sv })}
        </span>
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  filter,
  canCreate,
}: {
  filter: FilterKey
  canCreate: boolean
}) {
  const isActiveFilter = filter === 'aktiva'
  return (
    <div className="rounded-md border p-12 text-center">
      <p className="text-sm italic text-muted-foreground">
        {isActiveFilter
          ? 'Du har inga aktiva kontroller just nu.'
          : 'Inga kontroller matchar det valda filtret.'}
      </p>
      {isActiveFilter && canCreate ? (
        <div className="mt-4">
          <Button asChild>
            <Link href="/laglistor/kontroller/skapa">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Skapa kontroll
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

'use client'

/**
 * Story 21.5.2 → migrated in Story 28.11 (Epic 28) onto the unified
 * DataTable core. Columns + filter chips + page chrome stay here; sorting,
 * row-click guard and the narrow-container card renderer come from the
 * core. Status sorts by lifecycle rank (planerad → pågående → avslutad),
 * not alphabetically — preserved via the accessor.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Plus, ClipboardCheck } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DataTable, useLocalSorting } from '@/components/ui/data-table'
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state'
import { CycleStatusBadge } from '@/components/features/compliance-audit/cycle-detail/cycle-status-badge'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import { PageHeader } from '@/components/ui/page-header'
import { SortableHeader } from '@/components/ui/sortable-header'
import { TableToolbar } from '@/components/ui/table-toolbar'
import type { CycleSummary } from '@/app/actions/compliance-audit-cycle'
import { ComplianceCycleStatus, AuditType } from '@prisma/client'

// Story 21.26 — `forseglade` filter removed alongside the SEAL collapse.
// Story 21.27 — `arkiverade` filter removed alongside the ARKIVERAD collapse.
type FilterKey = 'aktiva' | 'slutforda' | 'alla'

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
  { key: 'alla', label: 'Alla', statuses: 'all' },
]

// Status sort follows the lifecycle order (planerad → pågående → avslutad)
// rather than alphabetical. Partial map + fallback keeps it resilient to any
// other enum values.
const STATUS_RANK: Partial<Record<ComplianceCycleStatus, number>> = {
  [ComplianceCycleStatus.PLANERAD]: 0,
  [ComplianceCycleStatus.PAGAENDE]: 1,
  [ComplianceCycleStatus.AVSLUTAD]: 2,
}
const statusRank = (s: ComplianceCycleStatus): number => STATUS_RANK[s] ?? 99

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

function formatPeriod(cycle: CycleSummary): string {
  // Drop the (repeated) start year when the range stays in one year, so the
  // common case reads "22 juni – 24 juni 2026" and fits on one line.
  const sameYear =
    cycle.scheduledStart.getFullYear() === cycle.scheduledEnd.getFullYear()
  return (
    format(cycle.scheduledStart, sameYear ? 'd MMM' : 'd MMM yyyy', {
      locale: sv,
    }) +
    ' – ' +
    format(cycle.scheduledEnd, 'd MMM yyyy', { locale: sv })
  )
}

interface CycleListTableProps {
  cycles: CycleSummary[]
  canCreate: boolean
}

export function CycleListTable({ cycles, canCreate }: CycleListTableProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('aktiva')
  const sorting = useLocalSorting([{ id: 'created', desc: true }])

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
      alla: cycles.length,
    }
  }, [cycles])

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!

  const filtered = useMemo(() => {
    if (activeFilter.statuses === 'all') return cycles
    const set = new Set(activeFilter.statuses)
    return cycles.filter((c) => set.has(c.status))
  }, [cycles, activeFilter])

  const columns = useMemo<ColumnDef<CycleSummary, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => row.name,
        header: ({ column }) => <SortableHeader column={column} label="Namn" />,
        cell: ({ row }) => (
          <div>
            {/* Anchor gives keyboard access + open-in-new-tab; the row's
                click handles the mouse convenience case. */}
            <Link
              href={`/laglistor/kontroller/${row.original.id}`}
              className="block font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {row.original.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              {row.original.auditType === AuditType.INTERN
                ? 'Intern'
                : 'Extern'}{' '}
              revision
            </div>
          </div>
        ),
        size: 260,
        minSize: 180,
        meta: {
          dt: { label: 'Namn', fill: true, card: { role: 'title' } },
        },
      },
      {
        id: 'status',
        accessorFn: (row) => statusRank(row.status),
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => <CycleStatusBadge status={row.original.status} />,
        size: 144,
        meta: {
          dt: { label: 'Status', card: { role: 'badge', priority: 0 } },
        },
      },
      {
        id: 'lawList',
        accessorFn: (row) => row.lawList.name,
        header: ({ column }) => (
          <SortableHeader column={column} label="Laglista" />
        ),
        cell: ({ row }) => (
          <span className="truncate">{row.original.lawList.name}</span>
        ),
        size: 200,
        meta: {
          dt: { label: 'Laglista', card: { role: 'meta', priority: 1 } },
        },
      },
      {
        id: 'itemCount',
        accessorFn: (row) => row.itemCount,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.itemCount}</span>
        ),
        size: 144,
        meta: {
          dt: {
            label: 'Dokument',
            numeric: true,
            card: { role: 'meta', priority: 3 },
          },
        },
      },
      {
        id: 'period',
        accessorFn: (row) => row.scheduledStart.getTime(),
        header: ({ column }) => (
          <SortableHeader column={column} label="Period" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatPeriod(row.original)}
          </span>
        ),
        size: 192,
        meta: {
          dt: { label: 'Period', card: { role: 'meta', priority: 2 } },
        },
      },
      {
        id: 'auditor',
        accessorFn: (row) => row.leadAuditor.name ?? '',
        header: ({ column }) => (
          <SortableHeader column={column} label="Ansvarig revisor" />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {initials(row.original.leadAuditor.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">
              {row.original.leadAuditor.name ?? 'Okänd'}
            </span>
          </span>
        ),
        size: 190,
        meta: {
          dt: {
            label: 'Ansvarig revisor',
            // Full label overflows the card's label gutter — shorten there.
            card: { role: 'meta', priority: 4, cardLabel: 'Ansvarig' },
          },
        },
      },
      {
        id: 'created',
        accessorFn: (row) => row.createdAt.getTime(),
        header: ({ column }) => (
          <SortableHeader column={column} label="Skapad" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {format(row.original.createdAt, 'd MMM yyyy', { locale: sv })}
          </span>
        ),
        size: 144,
        meta: {
          dt: { label: 'Skapad', card: { role: 'footer' } },
        },
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kontroller"
        subtitle="Hantera pågående och tidigare efterlevnadskontroller."
        primaryAction={
          canCreate ? (
            <Button asChild>
              <Link href="/laglistor/kontroller/skapa">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Skapa kontroll
              </Link>
            </Button>
          ) : undefined
        }
      />

      <TableToolbar
        filters={
          <FilterChipGroup aria-label="Filtrera kontroller efter status">
            {FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                pressed={f.key === filter}
                onPressedChange={() => setFilter(f.key)}
                count={counts[f.key]}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterChipGroup>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState filter={activeFilter.key} canCreate={canCreate} />
      ) : (
        <DataTable<CycleSummary>
          data={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          sorting={sorting}
          rowInteraction={{
            onRowClick: (row) => router.push(`/laglistor/kontroller/${row.id}`),
          }}
          view={{ cardBelow: 800 }}
        />
      )}
    </div>
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
  if (isActiveFilter) {
    return (
      <SharedEmptyState
        className="rounded-md border"
        icon={
          <SharedEmptyState.Icon>
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
          </SharedEmptyState.Icon>
        }
        title="Inga kontroller ännu"
        description="Skapa en efterlevnadskontroll för att visa att ni faktiskt lever upp till lagkraven — och få en delbar rapport på köpet."
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/laglistor/kontroller/skapa">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Skapa kontroll
              </Link>
            </Button>
          ) : undefined
        }
      />
    )
  }
  return (
    <SharedEmptyState
      className="rounded-md border"
      description="Inga kontroller matchar det valda filtret."
    />
  )
}

'use client'

/**
 * Story 28.1 demo harness + expansion×virtualization spike surface.
 *
 * Exercises the full core against 1,000 synthetic rows: local sorting,
 * Set-based selection, localStorage column state, resize clamp, expansion
 * with variable-height details under virtualization, and the
 * container-width table↔card switch (drag the width slider across 640px
 * to watch the hysteresis band).
 */
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  DataTable,
  useLocalSorting,
  useLocalStorageColumnState,
} from '@/components/ui/data-table'

interface DemoRow {
  id: string
  title: string
  status: 'Uppfylld' | 'Delvis uppfylld' | 'Ej uppfylld'
  priority: 'Hög' | 'Medel' | 'Låg'
  responsible: string
  amount: number
  addedAt: string
  detailLines: number
}

const STATUSES = ['Uppfylld', 'Delvis uppfylld', 'Ej uppfylld'] as const
const PRIORITIES = ['Hög', 'Medel', 'Låg'] as const
const PEOPLE = ['Anna Ek', 'Johan Berg', 'Sara Lund', 'Erik Ström', '—']

function makeRows(count: number): DemoRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i + 1}`,
    title: `Föreskrift ${i + 1} om systematiskt arbetsmiljöarbete`,
    status: STATUSES[i % STATUSES.length]!,
    priority: PRIORITIES[i % PRIORITIES.length]!,
    responsible: PEOPLE[i % PEOPLE.length]!,
    amount: ((i * 37) % 900) + 100,
    addedAt: `2026-0${(i % 6) + 1}-1${i % 9}`,
    // Variable detail heights — the spike's point.
    detailLines: (i % 7) + 1,
  }))
}

const STATUS_TONE: Record<DemoRow['status'], string> = {
  Uppfylld:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  'Delvis uppfylld':
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Ej uppfylld':
    'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
}

export function DataTableDemoClient() {
  const [rowCount, setRowCount] = useState(1000)
  const [containerWidth, setContainerWidth] = useState(900)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)

  const data = useMemo(() => makeRows(rowCount), [rowCount])
  const sorting = useLocalSorting([])
  const columnState = useLocalStorageColumnState({
    key: 'styleguide:data-table-demo',
  })

  const columns = useMemo<ColumnDef<DemoRow, unknown>[]>(
    () => [
      {
        id: 'expand',
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => row.toggleExpanded()}
            aria-label={row.getIsExpanded() ? 'Stäng detalj' : 'Visa detalj'}
            aria-expanded={row.getIsExpanded()}
            className="flex w-full items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${
                row.getIsExpanded() ? 'rotate-90' : ''
              }`}
            />
          </button>
        ),
        meta: {
          dt: {
            label: 'Expandera',
            pinned: 'left',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
      {
        accessorKey: 'title',
        minSize: 150,
        maxSize: 600,
        size: 320,
        header: ({ column }) => (
          <SortableHeader column={column} label="Titel" />
        ),
        cell: ({ row }) => (
          <span className="block truncate font-medium">
            {row.original.title}
          </span>
        ),
        meta: {
          dt: { label: 'Titel', stickyLeft: true, card: { role: 'title' } },
        },
      },
      {
        accessorKey: 'status',
        size: 160,
        minSize: 120,
        maxSize: 220,
        header: ({ column }) => (
          <SortableHeader column={column} label="Efterlevnad" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className={STATUS_TONE[row.original.status]}>
            {row.original.status}
          </Badge>
        ),
        meta: {
          dt: {
            label: 'Efterlevnad',
            card: { role: 'badge', priority: 0 },
            headerTooltip: {
              title: 'Efterlevnad',
              lines: ['Demo av headerTooltip-metadata.'],
            },
          },
        },
      },
      {
        accessorKey: 'priority',
        size: 120,
        minSize: 100,
        maxSize: 180,
        header: ({ column }) => (
          <SortableHeader column={column} label="Prioritet" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.priority}</Badge>
        ),
        meta: {
          dt: { label: 'Prioritet', card: { role: 'badge', priority: 1 } },
        },
      },
      {
        accessorKey: 'responsible',
        size: 160,
        minSize: 120,
        maxSize: 220,
        header: ({ column }) => (
          <SortableHeader column={column} label="Ansvarig" />
        ),
        meta: {
          dt: { label: 'Ansvarig', card: { role: 'meta' } },
        },
      },
      {
        accessorKey: 'amount',
        size: 110,
        minSize: 90,
        maxSize: 160,
        header: ({ column }) => (
          <SortableHeader column={column} label="Belopp" />
        ),
        cell: ({ row }) => `${row.original.amount} kr`,
        meta: {
          dt: {
            label: 'Belopp',
            numeric: true,
            card: { role: 'meta', cardLabel: 'Belopp' },
          },
        },
      },
      {
        accessorKey: 'addedAt',
        size: 120,
        minSize: 100,
        maxSize: 160,
        header: ({ column }) => (
          <SortableHeader column={column} label="Tillagd" />
        ),
        meta: {
          dt: { label: 'Tillagd', card: { role: 'footer' } },
        },
      },
    ],
    []
  )

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-lg font-medium">DataTable — Story 28.1 harness</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6 rounded-md border p-3 text-sm">
        <label className="flex items-center gap-2">
          Rader:
          <select
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
            className="rounded border bg-background px-2 py-1"
          >
            <option value={0}>0</option>
            <option value={5}>5 (ej virtualiserad)</option>
            <option value={99}>99 (tröskel)</option>
            <option value={101}>101 (virtualiserad)</option>
            <option value={1000}>1 000</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Containerbredd: {containerWidth}px
          <input
            type="range"
            min={320}
            max={1100}
            step={1}
            value={containerWidth}
            onChange={(e) => setContainerWidth(Number(e.target.value))}
            className="w-64"
          />
        </label>
        <span className="text-muted-foreground">
          Markerade: {selected.size}
          {lastClicked ? ` · Senast klickad: ${lastClicked}` : ''}
        </span>
      </div>

      {/* Width-constrained container simulating the chat-sidebar squeeze */}
      <div
        style={{ width: containerWidth }}
        className="rounded-lg border border-dashed p-2"
        data-testid="squeeze-container"
      >
        <DataTable<DemoRow>
          data={data}
          columns={columns}
          getRowId={(row) => row.id}
          sorting={sorting}
          selection={{ selected, onSelectedChange: setSelected }}
          columnState={columnState}
          expansion={{
            renderExpanded: (row) => (
              <div className="space-y-1 p-2 text-sm" data-testid="detail">
                <p className="font-medium">Detalj för {row.original.title}</p>
                {Array.from({ length: row.original.detailLines }).map(
                  (_, i) => (
                    <p key={i} className="text-muted-foreground">
                      Kravpunkt {i + 1}: verksamheten uppfyller kraven enligt
                      dokumenterad rutin.
                    </p>
                  )
                )}
              </div>
            ),
          }}
          rowInteraction={{
            onRowClick: (row, { view }) => {
              setLastClicked(`${row.id} (${view})`)
              // Row click doubles as expand toggle in this harness.
            },
          }}
          virtualization={{ maxHeight: 480 }}
          status={{ isFiltered: false }}
        />
      </div>

      <p className="max-w-xl text-xs text-muted-foreground">
        Spike-kontroller: sätt 1 000 rader, expandera rader högst upp / i mitten
        / längst ner (klicka på expanderpilen), scrolla igenom och verifiera att
        inga rader överlappar. Dra breddreglaget över 640 px och verifiera att
        kort↔tabell inte fladdrar i hysteresbandet (640–664 px).
      </p>
    </div>
  )
}

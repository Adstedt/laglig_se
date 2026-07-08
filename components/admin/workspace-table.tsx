'use client'

/**
 * Story 28.5: migrated onto the unified DataTable core via AdminDataTable.
 * This file owns columns, header and filters; URL state, debounced search,
 * sorting and pagination live in admin-data-table.tsx.
 */

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Search } from 'lucide-react'

import {
  AdminDataTable,
  useAdminSearch,
  useAdminSorting,
} from '@/components/admin/admin-data-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  STATUS_LABELS,
  STATUS_VARIANT,
  TIER_LABELS,
} from '@/lib/admin/constants'
import type { WorkspaceListItem } from '@/lib/admin/queries'
import type { SubscriptionTier, WorkspaceStatus } from '@prisma/client'

interface WorkspaceTableProps {
  data: WorkspaceListItem[]
  total: number
  page: number
  pageSize: number
  currentSearch?: string | undefined
  currentTier?: SubscriptionTier | undefined
  currentStatus?: WorkspaceStatus | undefined
  currentSortBy: string
  currentSortDir: 'asc' | 'desc'
}

export function WorkspaceTable({
  data,
  total,
  page,
  pageSize,
  currentSearch,
  currentTier,
  currentStatus,
  currentSortBy,
  currentSortDir,
}: WorkspaceTableProps) {
  const { searchValue, setSearchValue, updateParams } =
    useAdminSearch(currentSearch)
  const sorting = useAdminSorting(currentSortBy, currentSortDir)

  const columns = useMemo<ColumnDef<WorkspaceListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} label="Namn" />,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
        size: 220,
        minSize: 160,
        enableSorting: true,
        meta: { dt: { label: 'Namn', fill: true, card: { role: 'title' } } },
      },
      {
        id: 'slug',
        accessorKey: 'slug',
        header: ({ column }) => <SortableHeader column={column} label="Slug" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.slug}</span>
        ),
        size: 160,
        enableSorting: true,
        meta: { dt: { label: 'Slug', card: { role: 'meta', priority: 2 } } },
      },
      {
        id: 'owner',
        header: 'Ägare',
        cell: ({ row }) => row.original.owner.email,
        size: 220,
        enableSorting: false,
        meta: { dt: { label: 'Ägare', card: { role: 'meta', priority: 1 } } },
      },
      {
        id: 'subscription_tier',
        accessorKey: 'subscription_tier',
        header: ({ column }) => <SortableHeader column={column} label="Nivå" />,
        cell: ({ row }) => (
          <Badge variant="outline">
            {TIER_LABELS[row.original.subscription_tier]}
          </Badge>
        ),
        size: 120,
        enableSorting: true,
        meta: { dt: { label: 'Nivå', card: { role: 'badge', priority: 1 } } },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
        size: 110,
        enableSorting: true,
        meta: { dt: { label: 'Status', card: { role: 'badge', priority: 0 } } },
      },
      {
        id: 'members',
        header: 'Medlemmar',
        cell: ({ row }) => row.original._count.members,
        size: 110,
        enableSorting: false,
        meta: {
          dt: { label: 'Medlemmar', numeric: true, card: { role: 'meta' } },
        },
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Skapad" />
        ),
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'yyyy-MM-dd', {
            locale: sv,
          }),
        size: 120,
        enableSorting: true,
        meta: { dt: { label: 'Skapad', card: { role: 'footer' } } },
      },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Arbetsytor</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn, slug eller ägare..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={currentTier ?? 'ALL'}
          onValueChange={(value) =>
            updateParams({ tier: value === 'ALL' ? null : value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alla nivåer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alla nivåer</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SOLO">Solo</SelectItem>
            <SelectItem value="TEAM">Team</SelectItem>
            <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentStatus ?? 'ALL'}
          onValueChange={(value) =>
            updateParams({ status: value === 'ALL' ? null : value })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alla statusar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alla statusar</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="PAUSED">Pausad</SelectItem>
            <SelectItem value="DELETED">Borttagen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminDataTable<WorkspaceListItem>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        total={total}
        page={page}
        pageSize={pageSize}
        entityLabel="arbetsytor"
        detailHref={(row) => `/admin/workspaces/${row.id}`}
        emptyMessage="Inga arbetsytor hittades"
      />
    </div>
  )
}

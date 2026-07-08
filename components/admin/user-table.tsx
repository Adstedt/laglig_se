'use client'

/**
 * Story 28.5: migrated onto the unified DataTable core via AdminDataTable.
 * This file owns columns and search; URL state, debounced search, sorting
 * and pagination live in admin-data-table.tsx.
 */

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Search } from 'lucide-react'

import {
  AdminDataTable,
  useAdminSearch,
  useAdminSorting,
} from '@/components/admin/admin-data-table'
import { Input } from '@/components/ui/input'
import { SortableHeader } from '@/components/ui/sortable-header'
import type { UserListItem } from '@/lib/admin/queries'

interface UserTableProps {
  data: UserListItem[]
  total: number
  page: number
  pageSize: number
  currentSearch?: string | undefined
  currentSortBy: string
  currentSortDir: 'asc' | 'desc'
}

function formatLastLogin(date: Date | null): string {
  if (!date) return 'Aldrig'
  return formatDistanceToNow(date, { addSuffix: true, locale: sv })
}

export function UserTable({
  data,
  total,
  page,
  pageSize,
  currentSearch,
  currentSortBy,
  currentSortDir,
}: UserTableProps) {
  const { searchValue, setSearchValue } = useAdminSearch(currentSearch)
  const sorting = useAdminSorting(currentSortBy, currentSortDir)

  const columns = useMemo<ColumnDef<UserListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} label="Namn" />,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name ?? '—'}</span>
        ),
        size: 200,
        minSize: 150,
        enableSorting: true,
        meta: { dt: { label: 'Namn', fill: true, card: { role: 'title' } } },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="E-post" />
        ),
        cell: ({ row }) => row.original.email,
        size: 240,
        enableSorting: true,
        meta: { dt: { label: 'E-post', card: { role: 'meta', priority: 0 } } },
      },
      {
        id: 'last_login_at',
        accessorKey: 'last_login_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Senaste inloggning" />
        ),
        cell: ({ row }) =>
          formatLastLogin(
            row.original.last_login_at
              ? new Date(row.original.last_login_at)
              : null
          ),
        size: 180,
        enableSorting: true,
        meta: {
          dt: {
            label: 'Senaste inloggning',
            card: { role: 'meta', priority: 1 },
          },
        },
      },
      {
        id: 'workspace_count',
        header: 'Arbetsytor',
        cell: ({ row }) => row.original._count.workspace_members,
        size: 110,
        enableSorting: false,
        meta: {
          dt: { label: 'Arbetsytor', numeric: true, card: { role: 'meta' } },
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
      {/* Search */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn eller e-post..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <AdminDataTable<UserListItem>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        total={total}
        page={page}
        pageSize={pageSize}
        entityLabel="användare"
        detailHref={(row) => `/admin/users/${row.id}`}
        emptyMessage="Inga användare hittades"
      />
    </div>
  )
}

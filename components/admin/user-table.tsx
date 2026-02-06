'use client'

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

function useUpdateSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      if (!('page' in updates)) params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )
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
  const router = useRouter()
  const updateParams = useUpdateSearchParams()
  const [searchValue, setSearchValue] = useState(currentSearch ?? '')

  useEffect(() => {
    setSearchValue(currentSearch ?? '')
  }, [currentSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (currentSearch ?? '')) {
        updateParams({
          search: searchValue || null,
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, currentSearch, updateParams])

  const handleSort = useCallback(
    (field: string) => {
      const newDir =
        currentSortBy === field && currentSortDir === 'asc' ? 'desc' : 'asc'
      updateParams({ sortBy: field, sortDir: newDir, page: null })
    },
    [currentSortBy, currentSortDir, updateParams]
  )

  const totalPages = Math.ceil(total / pageSize)

  const columns: ColumnDef<UserListItem>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: () => (
          <SortableHeader
            label="Namn"
            field="name"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'email',
        header: () => (
          <SortableHeader
            label="E-post"
            field="email"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => row.original.email,
      },
      {
        accessorKey: 'last_login_at',
        header: () => (
          <SortableHeader
            label="Senaste inloggning"
            field="last_login_at"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) =>
          formatLastLogin(
            row.original.last_login_at
              ? new Date(row.original.last_login_at)
              : null
          ),
      },
      {
        id: 'workspace_count',
        header: 'Arbetsytor',
        cell: ({ row }) => row.original._count.workspace_members,
      },
      {
        accessorKey: 'created_at',
        header: () => (
          <SortableHeader
            label="Skapad"
            field="created_at"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'yyyy-MM-dd', {
            locale: sv,
          }),
      },
    ],
    [currentSortBy, currentSortDir, handleSort]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/users/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  Inga användare hittades
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `Visar ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} av ${total} användare`
            : 'Inga användare att visa'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-4 w-4" />
            Föregående
          </Button>
          <span className="text-sm text-muted-foreground">
            Sida {page} av {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: String(page + 1) })}
          >
            Nästa
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortableHeader({
  label,
  field,
  currentSortBy,
  currentSortDir,
  onSort,
}: {
  label: string
  field: string
  currentSortBy: string
  currentSortDir: 'asc' | 'desc'
  onSort: (_field: string) => void
}) {
  const isActive = currentSortBy === field
  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        className={`h-3.5 w-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground/50'}`}
      />
      {isActive && (
        <span className="sr-only">
          {currentSortDir === 'asc' ? '(stigande)' : '(fallande)'}
        </span>
      )}
    </button>
  )
}

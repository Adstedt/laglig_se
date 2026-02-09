'use client'

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { TemplateCreateDialog } from '@/components/admin/template-create-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_STATUS_VARIANT,
} from '@/lib/admin/constants'
import type { TemplateListItem } from '@/lib/admin/template-queries'
import type { TemplateStatus } from '@prisma/client'

interface TemplateTableProps {
  data: TemplateListItem[]
  total: number
  page: number
  pageSize: number
  currentSearch?: string | undefined
  currentStatus?: TemplateStatus | undefined
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

export function TemplateTable({
  data,
  total,
  page,
  pageSize,
  currentSearch,
  currentStatus,
  currentSortBy,
  currentSortDir,
}: TemplateTableProps) {
  const router = useRouter()
  const updateParams = useUpdateSearchParams()
  const [searchValue, setSearchValue] = useState(currentSearch ?? '')
  const [createOpen, setCreateOpen] = useState(false)

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

  const columns: ColumnDef<TemplateListItem>[] = useMemo(
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
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_variant && (
              <Badge variant="outline" className="text-xs">
                Variant
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'domain',
        header: () => (
          <SortableHeader
            label="Domän"
            field="domain"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.domain}</Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <SortableHeader
            label="Status"
            field="status"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={TEMPLATE_STATUS_VARIANT[row.original.status]}>
            {TEMPLATE_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        id: 'document_count',
        header: 'Dokument',
        cell: ({ row }) => row.original.document_count,
      },
      {
        id: 'section_count',
        header: 'Sektioner',
        cell: ({ row }) => row.original.section_count,
      },
      {
        accessorKey: 'updated_at',
        header: () => (
          <SortableHeader
            label="Uppdaterad"
            field="updated_at"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) =>
          format(new Date(row.original.updated_at), 'yyyy-MM-dd', {
            locale: sv,
          }),
      },
      {
        accessorKey: 'published_at',
        header: () => (
          <SortableHeader
            label="Publicerad"
            field="published_at"
            currentSortBy={currentSortBy}
            currentSortDir={currentSortDir}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) =>
          row.original.published_at
            ? format(new Date(row.original.published_at), 'yyyy-MM-dd', {
                locale: sv,
              })
            : '—',
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mallar</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Skapa mall
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Sök namn eller slug..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={currentStatus ?? 'ALL'}
          onValueChange={(value) =>
            updateParams({ status: value === 'ALL' ? null : value })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alla statusar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alla statusar</SelectItem>
            <SelectItem value="DRAFT">Utkast</SelectItem>
            <SelectItem value="IN_REVIEW">Under granskning</SelectItem>
            <SelectItem value="PUBLISHED">Publicerad</SelectItem>
            <SelectItem value="ARCHIVED">Arkiverad</SelectItem>
          </SelectContent>
        </Select>
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
                  onClick={() =>
                    router.push(`/admin/templates/${row.original.id}`)
                  }
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
                  Inga mallar hittades
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
            ? `Visar ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} av ${total} mallar`
            : 'Inga mallar att visa'}
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
            Sida {page} av {totalPages || 1}
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

      <TemplateCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
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

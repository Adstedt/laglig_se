'use client'

/**
 * Story 28.5: migrated onto the unified DataTable core via AdminDataTable.
 * This file owns columns, header and filters; URL state, debounced search,
 * sorting and pagination live in admin-data-table.tsx.
 */

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Plus, Search } from 'lucide-react'

import {
  AdminDataTable,
  useAdminSearch,
  useAdminSorting,
} from '@/components/admin/admin-data-table'
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
import { SortableHeader } from '@/components/ui/sortable-header'
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
  const { searchValue, setSearchValue, updateParams } =
    useAdminSearch(currentSearch)
  const sorting = useAdminSorting(currentSortBy, currentSortDir)
  const [createOpen, setCreateOpen] = useState(false)

  const columns = useMemo<ColumnDef<TemplateListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} label="Namn" />,
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
        size: 260,
        minSize: 180,
        enableSorting: true,
        meta: { dt: { label: 'Namn', fill: true, card: { role: 'title' } } },
      },
      {
        id: 'domain',
        accessorKey: 'domain',
        header: ({ column }) => (
          <SortableHeader column={column} label="Domän" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.domain}</Badge>
        ),
        size: 130,
        enableSorting: true,
        meta: { dt: { label: 'Domän', card: { role: 'badge', priority: 1 } } },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <SortableHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant={TEMPLATE_STATUS_VARIANT[row.original.status]}>
            {TEMPLATE_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
        size: 140,
        enableSorting: true,
        meta: { dt: { label: 'Status', card: { role: 'badge', priority: 0 } } },
      },
      {
        id: 'document_count',
        header: 'Dokument',
        cell: ({ row }) => row.original.document_count,
        size: 100,
        enableSorting: false,
        meta: {
          dt: { label: 'Dokument', numeric: true, card: { role: 'meta' } },
        },
      },
      {
        id: 'section_count',
        header: 'Sektioner',
        cell: ({ row }) => row.original.section_count,
        size: 100,
        enableSorting: false,
        meta: {
          dt: { label: 'Sektioner', numeric: true, card: { role: 'meta' } },
        },
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Uppdaterad" />
        ),
        cell: ({ row }) =>
          format(new Date(row.original.updated_at), 'yyyy-MM-dd', {
            locale: sv,
          }),
        size: 130,
        enableSorting: true,
        meta: { dt: { label: 'Uppdaterad', card: { role: 'footer' } } },
      },
      {
        id: 'published_at',
        accessorKey: 'published_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Publicerad" />
        ),
        cell: ({ row }) =>
          row.original.published_at
            ? format(new Date(row.original.published_at), 'yyyy-MM-dd', {
                locale: sv,
              })
            : '—',
        size: 130,
        enableSorting: true,
        meta: { dt: { label: 'Publicerad', card: { role: 'meta' } } },
      },
    ],
    []
  )

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

      <AdminDataTable<TemplateListItem>
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        total={total}
        page={page}
        pageSize={pageSize}
        entityLabel="mallar"
        detailHref={(row) => `/admin/templates/${row.id}`}
        emptyMessage="Inga mallar hittades"
      />

      <TemplateCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

'use client'

/**
 * Story 6.7b → migrated in Story 28.11 (Epic 28) onto the unified DataTable
 * core. The hand-rolled sort/resize/selection scaffolding is gone — the core
 * supplies sortable headers, clamped resize persistence and controlled
 * selection. Folders always sort above files (only by name/modified), so
 * ordering stays consumer-side via a manual SortingAdapter.
 *
 * Folder open stays DOUBLE-click (file-explorer convention): the core fires
 * onRowClick per click, and the second click of a double-click arrives with
 * event.detail === 2.
 */

import { useMemo, useState, useCallback } from 'react'
import type { SortingState } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import {
  DataTable,
  useLocalStorageColumnState,
} from '@/components/ui/data-table'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SortableHeader } from '@/components/ui/sortable-header'
import { getFileIcon, formatFileSize } from './file-dropzone'
import { categoryLabels, categoryColors } from './file-card'
import { ImagePreviewCompact } from './preview/image-preview'
import type { WorkspaceFileWithLinks, FolderInfo } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

export type SortField = 'name' | 'type' | 'size' | 'modified' | 'location'
export type SortDirection = 'asc' | 'desc'

interface FileListViewProps {
  folders: FolderInfo[]
  files: WorkspaceFileWithLinks[]
  selectedIds: Set<string>
  showSelection: boolean
  onFolderDoubleClick: (_folder: FolderInfo) => void
  onFileClick: (_file: WorkspaceFileWithLinks) => void
  onToggleSelect: (_id: string, _selected: boolean) => void
  onSelectAll: () => void
  onClearSelection: () => void
  getFileUrl?: (_file: WorkspaceFileWithLinks) => Promise<string | null>
  showLocationColumn?: boolean
}

type FileListRow =
  | { kind: 'folder'; id: string; folder: FolderInfo }
  | { kind: 'file'; id: string; file: WorkspaceFileWithLinks }

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get Swedish label for MIME type
 */
export function getFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'Okänd'

  // Images
  if (mimeType === 'image/jpeg') return 'JPEG-bild'
  if (mimeType === 'image/png') return 'PNG-bild'
  if (mimeType === 'image/gif') return 'GIF-bild'
  if (mimeType === 'image/webp') return 'WebP-bild'
  if (mimeType === 'image/svg+xml') return 'SVG-bild'
  if (mimeType.startsWith('image/')) return 'Bild'

  // PDF
  if (mimeType === 'application/pdf') return 'PDF-dokument'

  // Word
  if (mimeType === 'application/msword') return 'Word-dokument'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'Word-dokument'

  // Excel
  if (mimeType === 'application/vnd.ms-excel') return 'Excel-kalkylblad'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return 'Excel-kalkylblad'

  // PowerPoint
  if (mimeType === 'application/vnd.ms-powerpoint') return 'PowerPoint'
  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )
    return 'PowerPoint'

  // Text
  if (mimeType === 'text/plain') return 'Textfil'
  if (mimeType === 'text/html') return 'HTML-fil'
  if (mimeType === 'text/css') return 'CSS-fil'
  if (mimeType === 'text/csv') return 'CSV-fil'

  // Generic
  if (mimeType.startsWith('text/')) return 'Textfil'
  if (mimeType.startsWith('application/')) return 'Dokument'

  return 'Fil'
}

// ============================================================================
// Image Thumbnail Hover Component
// ============================================================================

function ImageThumbnailHover({
  file,
  getFileUrl,
  children,
}: {
  file: WorkspaceFileWithLinks
  getFileUrl?:
    | ((_file: WorkspaceFileWithLinks) => Promise<string | null>)
    | undefined
  children: React.ReactNode
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (open && !imageUrl && getFileUrl) {
        setIsLoading(true)
        try {
          const url = await getFileUrl(file)
          setImageUrl(url)
        } catch {
          // Ignore errors
        } finally {
          setIsLoading(false)
        }
      }
    },
    [file, getFileUrl, imageUrl]
  )

  // Only show hover card for images
  if (!file.mime_type?.startsWith('image/') || !getFileUrl) {
    return <>{children}</>
  }

  return (
    <HoverCard openDelay={300} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" className="w-64 p-2">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            Laddar...
          </div>
        ) : imageUrl ? (
          <ImagePreviewCompact
            url={imageUrl}
            alt={file.filename}
            className="h-40 rounded"
          />
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            Kunde inte läsa in bild
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

// ============================================================================
// Cells
// ============================================================================

function NameCell({
  row,
  getFileUrl,
}: {
  row: FileListRow
  getFileUrl?:
    | ((_file: WorkspaceFileWithLinks) => Promise<string | null>)
    | undefined
}) {
  if (row.kind === 'folder') {
    return (
      <div className="flex items-center gap-2 font-medium">
        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="truncate">{row.folder.filename}</span>
      </div>
    )
  }
  return (
    <ImageThumbnailHover file={row.file} getFileUrl={getFileUrl}>
      <div className="flex items-center gap-2 font-medium">
        {getFileIcon(row.file.mime_type)}
        <span className="truncate">{row.file.filename}</span>
      </div>
    </ImageThumbnailHover>
  )
}

function TypeCell({ row }: { row: FileListRow }) {
  if (row.kind === 'folder') {
    return <span className="text-muted-foreground">Mapp</span>
  }
  return (
    <Badge
      variant="secondary"
      className={cn('text-xs', categoryColors[row.file.category])}
    >
      {categoryLabels[row.file.category]}
    </Badge>
  )
}

// ============================================================================
// File List View Component
// ============================================================================

export function FileListView({
  folders,
  files,
  selectedIds,
  showSelection,
  onFolderDoubleClick,
  onFileClick,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  getFileUrl,
  showLocationColumn = false,
}: FileListViewProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false },
  ])
  const sortingAdapter = useMemo(
    () => ({ sorting, onSortingChange: setSorting, manual: true as const }),
    [sorting]
  )
  const columnState = useLocalStorageColumnState({
    key: 'laglig:files:columns:v1',
  })

  const sortField = (sorting[0]?.id ?? 'name') as SortField
  const sortDirection: SortDirection = sorting[0]?.desc ? 'desc' : 'asc'

  // Folders always sort above files; they only participate in name/modified
  // ordering (legacy parity). Location sort is a no-op until folder paths
  // exist on file data.
  const rows = useMemo<FileListRow[]>(() => {
    const multiplier = sortDirection === 'asc' ? 1 : -1

    const sortedFolders = [...folders].sort((a, b) => {
      if (sortField === 'name') {
        return multiplier * a.filename.localeCompare(b.filename, 'sv')
      }
      if (sortField === 'modified') {
        return (
          multiplier *
          (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        )
      }
      return 0
    })

    const sortedFiles = [...files].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return multiplier * a.filename.localeCompare(b.filename, 'sv')
        case 'type':
          return (
            multiplier *
            getFileTypeLabel(a.mime_type).localeCompare(
              getFileTypeLabel(b.mime_type),
              'sv'
            )
          )
        case 'size':
          return multiplier * ((a.file_size ?? 0) - (b.file_size ?? 0))
        case 'modified':
          return (
            multiplier *
            (new Date(a.updated_at).getTime() -
              new Date(b.updated_at).getTime())
          )
        default:
          return 0
      }
    })

    return [
      ...sortedFolders.map(
        (folder): FileListRow => ({ kind: 'folder', id: folder.id, folder })
      ),
      ...sortedFiles.map(
        (file): FileListRow => ({ kind: 'file', id: file.id, file })
      ),
    ]
  }, [folders, files, sortField, sortDirection])

  const columns = useMemo<ColumnDef<FileListRow, unknown>[]>(() => {
    const defs: ColumnDef<FileListRow, unknown>[] = [
      {
        id: 'name',
        header: ({ column }) => <SortableHeader column={column} label="Namn" />,
        cell: ({ row }) => (
          <NameCell row={row.original} getFileUrl={getFileUrl} />
        ),
        enableSorting: true,
        size: 250,
        minSize: 150,
        meta: {
          dt: {
            label: 'Namn',
            fill: true,
            mandatory: true,
            card: { role: 'title' },
          },
        },
      },
      {
        id: 'type',
        header: ({ column }) => <SortableHeader column={column} label="Typ" />,
        cell: ({ row }) => <TypeCell row={row.original} />,
        enableSorting: true,
        size: 120,
        minSize: 80,
        meta: {
          dt: { label: 'Typ', card: { role: 'badge', priority: 0 } },
        },
      },
      {
        id: 'size',
        header: ({ column }) => (
          <SortableHeader column={column} label="Storlek" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.kind === 'file'
              ? formatFileSize(row.original.file.file_size)
              : '—'}
          </span>
        ),
        enableSorting: true,
        size: 100,
        minSize: 80,
        meta: {
          dt: {
            label: 'Storlek',
            card: {
              role: 'meta',
              priority: 1,
              renderCard: (row) =>
                row.original.kind === 'file'
                  ? formatFileSize(row.original.file.file_size)
                  : null,
            },
          },
        },
      },
      {
        id: 'modified',
        header: ({ column }) => (
          <SortableHeader column={column} label="Ändrad" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(
              row.original.kind === 'file'
                ? row.original.file.updated_at
                : row.original.folder.updated_at
            ).toLocaleDateString('sv-SE')}
          </span>
        ),
        enableSorting: true,
        size: 140,
        minSize: 100,
        meta: {
          dt: { label: 'Ändrad', card: { role: 'footer' } },
        },
      },
    ]
    if (showLocationColumn) {
      defs.push({
        id: 'location',
        header: ({ column }) => (
          <SortableHeader column={column} label="Plats" />
        ),
        // TODO: Show folder path (needs folder path on file data)
        cell: () => <span className="text-muted-foreground">—</span>,
        enableSorting: true,
        size: 150,
        minSize: 100,
        meta: {
          dt: { label: 'Plats', card: { role: 'hidden' } },
        },
      })
    }
    return defs
  }, [getFileUrl, showLocationColumn])

  // The parent owns selection as toggle/selectAll/clear callbacks — diff the
  // core's next-Set against the current one and translate.
  const selection = useMemo(() => {
    if (!showSelection) return undefined
    const totalItems = folders.length + files.length
    return {
      selected: selectedIds,
      onSelectedChange: (next: Set<string>) => {
        if (next.size === 0 && selectedIds.size > 0) {
          onClearSelection()
          return
        }
        if (next.size === totalItems && selectedIds.size < totalItems) {
          onSelectAll()
          return
        }
        for (const id of next) {
          if (!selectedIds.has(id)) onToggleSelect(id, true)
        }
        for (const id of selectedIds) {
          if (!next.has(id)) onToggleSelect(id, false)
        }
      },
    }
  }, [
    showSelection,
    selectedIds,
    folders.length,
    files.length,
    onToggleSelect,
    onSelectAll,
    onClearSelection,
  ])

  return (
    <DataTable<FileListRow>
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      sorting={sortingAdapter}
      columnState={columnState}
      {...(selection ? { selection } : {})}
      rowInteraction={{
        onRowClick: (row, { event }) => {
          if (row.kind === 'file') {
            onFileClick(row.file)
          } else if (event.detail >= 2) {
            onFolderDoubleClick(row.folder)
          }
        },
      }}
      view={{ cardBelow: 800 }}
    />
  )
}

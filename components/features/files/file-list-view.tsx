'use client'

/**
 * Story 6.7b: Enhanced File List View
 * AC: 9, 10, 11, 12, 13 - Sortable columns, column resize, hover thumbnails
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Folder,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface ColumnConfig {
  id: string
  label: string
  width: number
  minWidth: number
  sortable: boolean
}

// ============================================================================
// Helpers
// ============================================================================

const STORAGE_KEY = 'file-list-column-widths'
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Namn', width: 250, minWidth: 150, sortable: true },
  { id: 'type', label: 'Typ', width: 120, minWidth: 80, sortable: true },
  { id: 'size', label: 'Storlek', width: 100, minWidth: 80, sortable: true },
  {
    id: 'modified',
    label: 'Ändrad',
    width: 140,
    minWidth: 100,
    sortable: true,
  },
  { id: 'location', label: 'Plats', width: 150, minWidth: 100, sortable: true },
]

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

function loadColumnWidths(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveColumnWidths(widths: Record<string, number>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// Sortable Header Component
// ============================================================================

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  width,
  onResizeStart,
  isResizing,
}: {
  label: string
  field: SortField
  currentSort: SortField
  currentDirection: SortDirection
  onSort: (_field: SortField) => void
  width: number
  onResizeStart: (_e: React.MouseEvent) => void
  isResizing: boolean
}) {
  const isActive = currentSort === field

  return (
    <TableHead
      className="relative select-none"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
        onClick={() => onSort(field)}
      >
        <span>{label}</span>
        {isActive ? (
          currentDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
      {/* Resize handle - using button for accessibility */}
      <button
        type="button"
        aria-label={`Ändra bredd på ${label}-kolumnen`}
        className={cn(
          'absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors focus:bg-primary/50 focus:outline-none border-0 bg-transparent p-0',
          isResizing && 'bg-primary'
        )}
        onMouseDown={onResizeStart}
      >
        <GripVertical className="h-3 w-3 absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-muted-foreground/50" />
      </button>
    </TableHead>
  )
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
  // Sort state
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Column width state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Load column widths from localStorage
  useEffect(() => {
    setColumnWidths(loadColumnWidths())
  }, [])

  // Get effective column width
  const getColumnWidth = (columnId: string): number => {
    const stored = columnWidths[columnId]
    if (stored) return stored
    const defaultCol = DEFAULT_COLUMNS.find((c) => c.id === columnId)
    return defaultCol?.width ?? 100
  }

  // Handle sort
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDirection('asc')
      }
    },
    [sortField]
  )

  // Handle column resize
  const handleResizeStart = useCallback(
    (columnId: string, e: React.MouseEvent) => {
      e.preventDefault()
      setResizingColumn(columnId)
      resizeStartX.current = e.clientX
      resizeStartWidth.current = getColumnWidth(columnId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnWidths]
  )

  // Mouse move handler for resize
  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current
      const minWidth =
        DEFAULT_COLUMNS.find((c) => c.id === resizingColumn)?.minWidth ?? 50
      const newWidth = Math.max(minWidth, resizeStartWidth.current + delta)

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      if (resizingColumn) {
        saveColumnWidths({
          ...columnWidths,
          [resizingColumn]: getColumnWidth(resizingColumn),
        })
      }
      setResizingColumn(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingColumn, columnWidths])

  // Sort files
  const sortedFiles = [...files].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1

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
          (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        )
      case 'location':
        // TODO: Add folder path to file data for location sorting
        return 0
      default:
        return 0
    }
  })

  // Sort folders (always by name for now)
  const sortedFolders = [...folders].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1
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

  const totalItems = folders.length + files.length
  const allSelected = selectedIds.size === totalItems && totalItems > 0

  // Filter columns based on showLocationColumn
  const visibleColumns = DEFAULT_COLUMNS.filter(
    (col) => col.id !== 'location' || showLocationColumn
  )

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    checked ? onSelectAll() : onClearSelection()
                  }
                />
              </TableHead>
            )}
            {visibleColumns.map((column) => (
              <SortableHeader
                key={column.id}
                label={column.label}
                field={column.id as SortField}
                currentSort={sortField}
                currentDirection={sortDirection}
                onSort={handleSort}
                width={getColumnWidth(column.id)}
                onResizeStart={(e) => handleResizeStart(column.id, e)}
                isResizing={resizingColumn === column.id}
              />
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Folders (always at top) */}
          {sortedFolders.map((folder) => (
            <TableRow
              key={folder.id}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                selectedIds.has(folder.id) && 'bg-primary/5'
              )}
              onDoubleClick={() => onFolderDoubleClick(folder)}
            >
              {showSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(folder.id)}
                    onCheckedChange={(checked) =>
                      onToggleSelect(folder.id, !!checked)
                    }
                  />
                </TableCell>
              )}
              <TableCell
                className="font-medium"
                style={{ width: getColumnWidth('name') }}
              >
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="truncate">{folder.filename}</span>
                </div>
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                style={{ width: getColumnWidth('type') }}
              >
                Mapp
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                style={{ width: getColumnWidth('size') }}
              >
                —
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                style={{ width: getColumnWidth('modified') }}
              >
                {new Date(folder.updated_at).toLocaleDateString('sv-SE')}
              </TableCell>
              {showLocationColumn && (
                <TableCell
                  className="text-muted-foreground"
                  style={{ width: getColumnWidth('location') }}
                >
                  —
                </TableCell>
              )}
              <TableCell />
            </TableRow>
          ))}

          {/* Files */}
          {sortedFiles.map((file) => (
            <TableRow
              key={file.id}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                selectedIds.has(file.id) && 'bg-primary/5'
              )}
              onClick={() => onFileClick(file)}
            >
              {showSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(file.id)}
                    onCheckedChange={(checked) =>
                      onToggleSelect(file.id, !!checked)
                    }
                  />
                </TableCell>
              )}
              <TableCell
                className="font-medium"
                style={{ width: getColumnWidth('name') }}
              >
                <ImageThumbnailHover file={file} getFileUrl={getFileUrl}>
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.mime_type)}
                    <span className="truncate">{file.filename}</span>
                  </div>
                </ImageThumbnailHover>
              </TableCell>
              <TableCell style={{ width: getColumnWidth('type') }}>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', categoryColors[file.category])}
                >
                  {categoryLabels[file.category]}
                </Badge>
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                style={{ width: getColumnWidth('size') }}
              >
                {formatFileSize(file.file_size)}
              </TableCell>
              <TableCell
                className="text-muted-foreground"
                style={{ width: getColumnWidth('modified') }}
              >
                {new Date(file.updated_at).toLocaleDateString('sv-SE')}
              </TableCell>
              {showLocationColumn && (
                <TableCell
                  className="text-muted-foreground truncate"
                  style={{ width: getColumnWidth('location') }}
                >
                  {/* TODO: Show folder path */}—
                </TableCell>
              )}
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

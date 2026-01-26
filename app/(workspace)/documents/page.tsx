'use client'

/**
 * Story 6.7a: Documents Page ("Mina dokument")
 * Workspace file browser with grid/list view, filtering, and file management
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Grid,
  List,
  Search,
  Upload,
  Filter,
  MoreVertical,
  Trash2,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  FileDropzone,
  formatFileSize,
} from '@/components/features/files/file-dropzone'
import {
  FileCard,
  FileCardSkeleton,
  categoryLabels,
  categoryColors,
} from '@/components/features/files/file-card'
import { FilePreviewPanel } from '@/components/features/files/file-preview-panel'
import { FileLinkModal } from '@/components/features/files/file-link-modal'
import { getFileIcon } from '@/components/features/files/file-dropzone'

import {
  getWorkspaceFiles,
  uploadFile,
  deleteFilesBulk,
  updateFilesCategoryBulk,
} from '@/app/actions/files'
import type { WorkspaceFileWithLinks, FileFilters } from '@/app/actions/files'
import type { FileCategory } from '@prisma/client'

// ============================================================================
// Component
// ============================================================================

export default function DocumentsPage() {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  // Data state
  const [files, setFiles] = useState<WorkspaceFileWithLinks[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>(
    'all'
  )

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSelection, setShowSelection] = useState(false)

  // Panel state
  const [previewFile, setPreviewFile] = useState<WorkspaceFileWithLinks | null>(
    null
  )
  const [linkFile, setLinkFile] = useState<WorkspaceFileWithLinks | null>(null)

  // Load files
  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: FileFilters = {}
      if (searchQuery) filters.search = searchQuery
      if (categoryFilter !== 'all') filters.category = categoryFilter

      const result = await getWorkspaceFiles(filters, {
        page: pagination.page,
        limit: pagination.limit,
      })

      if (result.success && result.data) {
        setFiles(result.data.files)
        setPagination(result.data.pagination)
      } else {
        toast.error(result.error || 'Kunde inte hämta filer')
      }
    } catch (error) {
      console.error('Load files error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, categoryFilter, pagination.page, pagination.limit])

  // Initial load and filter changes
  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Upload handler
  const handleUpload = async (filesToUpload: File[]) => {
    setIsUploading(true)
    try {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)

        const result = await uploadFile(formData)
        if (!result.success) {
          toast.error(`Kunde inte ladda upp ${file.name}: ${result.error}`)
        }
      }
      loadFiles()
    } finally {
      setIsUploading(false)
    }
  }

  // Selection handlers
  const toggleSelect = (fileId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(files.map((f) => f.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setShowSelection(false)
  }

  // Bulk actions
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const result = await deleteFilesBulk(ids)
    if (result.success) {
      toast.success(`${result.data?.deleted} fil(er) raderade`)
      clearSelection()
      loadFiles()
    } else {
      toast.error(result.error || 'Kunde inte radera filer')
    }
  }

  const handleBulkCategorize = async (category: FileCategory) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const result = await updateFilesCategoryBulk(ids, category)
    if (result.success) {
      toast.success(`${result.data?.updated} fil(er) uppdaterade`)
      clearSelection()
      loadFiles()
    } else {
      toast.error(result.error || 'Kunde inte uppdatera filer')
    }
  }

  // Pagination handlers
  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mina dokument</h1>
          <p className="text-sm text-muted-foreground">
            Hantera filer och dokument i din arbetsyta
          </p>
        </div>
        <Button onClick={() => document.getElementById('file-upload')?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Ladda upp
        </Button>
      </div>

      {/* Upload dropzone (hidden, triggered by button or drag) */}
      <div id="file-upload">
        <FileDropzone
          onUpload={handleUpload}
          currentFileCount={files.length}
          disabled={isUploading}
          className={isUploading ? 'opacity-50' : ''}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search and filters */}
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök filer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as FileCategory | 'all')}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {(Object.keys(categoryLabels) as FileCategory[]).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View toggle and selection */}
        <div className="flex items-center gap-2">
          {showSelection && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} valda
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Åtgärder
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(categoryLabels) as FileCategory[]).map(
                    (cat) => (
                      <DropdownMenuItem
                        key={cat}
                        onClick={() => handleBulkCategorize(cat)}
                      >
                        Kategorisera som {categoryLabels[cat]}
                      </DropdownMenuItem>
                    )
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleBulkDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Radera valda
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Avbryt
              </Button>
            </div>
          )}

          <Button
            variant={showSelection ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowSelection(!showSelection)}
          >
            {showSelection ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Välj
          </Button>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}
          >
            <ToggleGroupItem value="grid" aria-label="Rutnätsvy">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Listvy">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <FileCardSkeleton key={i} />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Inga filer ännu</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ladda upp filer genom att dra dem hit eller klicka på knappen ovan.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selectedIds.has(file.id)}
              onSelect={toggleSelect}
              onClick={setPreviewFile}
              showSelection={showSelection}
            />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {showSelection && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        selectedIds.size === files.length && files.length > 0
                      }
                      onCheckedChange={(checked) =>
                        checked ? selectAll() : clearSelection()
                      }
                    />
                  </TableHead>
                )}
                <TableHead>Namn</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Storlek</TableHead>
                <TableHead>Uppladdad</TableHead>
                <TableHead>Länkar</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow
                  key={file.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setPreviewFile(file)}
                >
                  {showSelection && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(file.id)}
                        onCheckedChange={(checked) =>
                          toggleSelect(file.id, !!checked)
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.mime_type)}
                      <span className="truncate max-w-[200px]">
                        {file.filename}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', categoryColors[file.category])}
                    >
                      {categoryLabels[file.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(file.created_at).toLocaleDateString('sv-SE')}
                  </TableCell>
                  <TableCell>
                    {file.task_links.length + file.list_item_links.length >
                      0 && (
                      <span className="text-xs text-muted-foreground">
                        {file.task_links.length + file.list_item_links.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                          Förhandsgranska
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLinkFile(file)}>
                          Länka till...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Visar {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} av{' '}
            {pagination.total} filer
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Sida {pagination.page} av {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Preview Panel */}
      <FilePreviewPanel
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        onUpdate={loadFiles}
        onDelete={loadFiles}
        onLinkClick={(file) => {
          setPreviewFile(null)
          setLinkFile(file)
        }}
      />

      {/* Link Modal */}
      <FileLinkModal
        file={linkFile}
        open={!!linkFile}
        onOpenChange={(open) => !open && setLinkFile(null)}
        onUpdate={() => {
          loadFiles()
          if (previewFile && linkFile && previewFile.id === linkFile.id) {
            // Refresh preview file data
            const updatedFile = files.find((f) => f.id === linkFile.id)
            if (updatedFile) setPreviewFile(updatedFile)
          }
        }}
      />
    </div>
  )
}

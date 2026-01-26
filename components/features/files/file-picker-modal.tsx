'use client'

/**
 * Story 6.7a: File Picker Modal
 * Searchable modal for selecting workspace files to link
 * Uses CommandDialog (cmdk) for keyboard-navigable search
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Upload } from 'lucide-react'
import { getFileIcon, formatFileSize } from './file-dropzone'
import { categoryLabels, categoryColors } from './file-card'
import { getWorkspaceFiles } from '@/app/actions/files'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface FilePickerModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onSelect: (_fileIds: string[]) => void
  excludeIds?: string[] // Already linked file IDs to show as disabled
  allowMultiple?: boolean
  onUploadNew?: () => void // Callback to open upload modal/dropzone
}

// ============================================================================
// Component
// ============================================================================

export function FilePickerModal({
  open,
  onOpenChange,
  onSelect,
  excludeIds = [],
  allowMultiple = true,
  onUploadNew,
}: FilePickerModalProps) {
  const [files, setFiles] = useState<WorkspaceFileWithLinks[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch files when modal opens
  useEffect(() => {
    if (open) {
      loadFiles()
    } else {
      // Reset selection when modal closes
      setSelected(new Set())
      setSearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      const result = await getWorkspaceFiles(
        searchQuery ? { search: searchQuery } : undefined,
        { limit: 50 }
      )

      if (result.success && result.data) {
        setFiles(result.data.files)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (!open) return

    const timer = setTimeout(() => {
      loadFiles()
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, open])

  const toggleSelect = useCallback(
    (fileId: string) => {
      if (excludeIds.includes(fileId)) return

      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(fileId)) {
          next.delete(fileId)
        } else {
          if (!allowMultiple) {
            next.clear()
          }
          next.add(fileId)
        }
        return next
      })
    },
    [excludeIds, allowMultiple]
  )

  const handleConfirm = () => {
    onSelect(Array.from(selected))
    setSelected(new Set())
    onOpenChange(false)
  }

  const availableFiles = files.filter((f) => !excludeIds.includes(f.id))
  const alreadyLinkedFiles = files.filter((f) => excludeIds.includes(f.id))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök filer..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />

      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>Inga filer hittades</CommandEmpty>

            {availableFiles.length > 0 && (
              <CommandGroup heading="Tillgängliga filer">
                {availableFiles.map((file) => (
                  <CommandItem
                    key={file.id}
                    value={`${file.filename} ${file.category}`}
                    onSelect={() => toggleSelect(file.id)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(file.id)}
                      className="pointer-events-none"
                    />
                    {getFileIcon(file.mime_type)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px]',
                        categoryColors[file.category]
                      )}
                    >
                      {categoryLabels[file.category]}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {alreadyLinkedFiles.length > 0 && (
              <CommandGroup heading="Redan länkade">
                {alreadyLinkedFiles.map((file) => (
                  <CommandItem
                    key={file.id}
                    value={`${file.filename} ${file.category}`}
                    disabled
                    className="flex items-center gap-3 opacity-50"
                  >
                    <Checkbox
                      checked
                      disabled
                      className="pointer-events-none"
                    />
                    {getFileIcon(file.mime_type)}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px]',
                        categoryColors[file.category]
                      )}
                    >
                      {categoryLabels[file.category]}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      <Separator />

      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onUploadNew && (
            <Button variant="outline" size="sm" onClick={onUploadNew}>
              <Upload className="h-4 w-4 mr-2" />
              Ladda upp ny
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {selected.size} fil{selected.size !== 1 ? 'er' : ''} vald
            {selected.size !== 1 ? 'a' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Lägg till valda
          </Button>
        </div>
      </div>
    </CommandDialog>
  )
}

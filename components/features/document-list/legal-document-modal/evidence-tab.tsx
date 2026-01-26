'use client'

/**
 * Story 6.3 + 6.7a: Evidence Tab
 * File management for law list items (linked evidence)
 */

import { useState, useRef } from 'react'
import {
  Upload,
  FolderOpen,
  Loader2,
  Download,
  Trash2,
  X,
  Paperclip,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  uploadFileAndLinkToListItem,
  getFilesForListItem,
  unlinkFile,
  deleteFile,
  getFileDownloadUrl,
  linkFilesToListItem,
} from '@/app/actions/files'
import { FilePickerModal } from '@/components/features/files/file-picker-modal'
import {
  getFileIcon,
  formatFileSize,
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
} from '@/components/features/files/file-dropzone'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'

interface EvidenceTabProps {
  listItemId: string
}

export function EvidenceTab({ listItemId }: EvidenceTabProps) {
  const [files, setFiles] = useState<WorkspaceFileWithLinks[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Load files on mount
  const loadFiles = async () => {
    setIsLoading(true)
    try {
      const result = await getFilesForListItem(listItemId)
      if (result.success && result.data) {
        setFiles(result.data)
      }
    } catch (error) {
      console.error('Load files error:', error)
    } finally {
      setIsLoading(false)
      setInitialLoadDone(true)
    }
  }

  // Initial load
  if (!initialLoadDone) {
    loadFiles()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    await handleFiles(droppedFiles)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    await handleFiles(selectedFiles)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFiles = async (filesToUpload: File[]) => {
    // Validate files
    for (const file of filesToUpload) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} är för stor (max 25MB)`)
        return
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name} - filtypen stöds inte`)
        return
      }
    }

    setIsUploading(true)
    try {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', 'BEVIS')

        const result = await uploadFileAndLinkToListItem(formData, listItemId)
        if (!result.success) {
          toast.error(`Kunde inte ladda upp ${file.name}: ${result.error}`)
        }
      }
      toast.success(
        filesToUpload.length === 1
          ? 'Filen har laddats upp'
          : `${filesToUpload.length} filer har laddats upp`
      )
      await loadFiles()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ett fel uppstod vid uppladdning')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (file: WorkspaceFileWithLinks) => {
    setDownloadingId(file.id)
    try {
      const result = await getFileDownloadUrl(file.id)
      if (result.success && result.data?.url) {
        window.open(result.data.url, '_blank')
      } else {
        toast.error(result.error || 'Kunde inte hämta nedladdningslänk')
      }
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleUnlink = async (file: WorkspaceFileWithLinks) => {
    setDeletingId(file.id)
    try {
      const result = await unlinkFile(file.id, 'list_item', listItemId)
      if (result.success) {
        toast.success('Filen har tagits bort')
        await loadFiles()
      } else {
        toast.error(result.error || 'Kunde inte ta bort filen')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDelete = async (file: WorkspaceFileWithLinks) => {
    setDeletingId(file.id)
    try {
      const result = await deleteFile(file.id)
      if (result.success) {
        toast.success('Filen har raderats permanent')
        await loadFiles()
      } else {
        toast.error(result.error || 'Kunde inte radera filen')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setDeletingId(null)
    }
  }

  const handlePickerSelect = async (fileIds: string[]) => {
    if (fileIds.length === 0) return

    try {
      const result = await linkFilesToListItem(fileIds, listItemId)
      if (result.success) {
        toast.success(
          fileIds.length === 1
            ? 'Filen har lagts till'
            : `${fileIds.length} filer har lagts till`
        )
        await loadFiles()
      } else {
        toast.error(result.error || 'Kunde inte länka filer')
      }
    } catch (error) {
      console.error('Link files error:', error)
      toast.error('Ett fel uppstod')
    }
  }

  const linkedFileIds = files.map((f) => f.id)

  if (isLoading && !initialLoadDone) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Ladda upp
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilePicker(true)}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Från Mina dokument
        </Button>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Laddar upp...</p>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Dra och släpp filer här
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'flex items-center justify-between gap-2 p-2 rounded-md',
                'bg-muted/50 hover:bg-muted transition-colors group'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(file.mime_type)}
                <div className="min-w-0">
                  <p className="text-sm truncate">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                >
                  {downloadingId === file.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Unlink */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Ta bort från lag"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ta bort fil?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Filen tas bort från denna lag men finns kvar i Mina
                        dokument.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleUnlink(file)}
                        disabled={deletingId === file.id}
                      >
                        {deletingId === file.id && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Ta bort
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete permanently */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Radera permanent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Radera fil permanent?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Filen &quot;{file.filename}&quot; kommer raderas
                        permanent. Detta kan inte ångras.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(file)}
                        disabled={deletingId === file.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deletingId === file.id && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Radera
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Paperclip className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Inga bevis ännu</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ladda upp filer eller välj från Mina dokument
          </p>
        </div>
      )}

      {/* File Picker Modal */}
      <FilePickerModal
        open={showFilePicker}
        onOpenChange={setShowFilePicker}
        onSelect={handlePickerSelect}
        excludeIds={linkedFileIds}
        onUploadNew={() => {
          setShowFilePicker(false)
          fileInputRef.current?.click()
        }}
      />
    </div>
  )
}

'use client'

/**
 * Story 6.6 + 6.7a: Evidence Box
 * File upload and management for task evidence
 * Updated to use actual file upload via server actions
 */

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  Loader2,
  FolderOpen,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskEvidence } from '@/app/actions/task-modal'
import { toast } from 'sonner'
import {
  uploadFileAndLinkToTask,
  unlinkFile,
  getFileDownloadUrl,
  deleteFile,
} from '@/app/actions/files'
import { FilePickerModal } from '@/components/features/files/file-picker-modal'
import { linkFilesToTask } from '@/app/actions/files'
import {
  getFileIcon,
  formatFileSize,
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
} from '@/components/features/files/file-dropzone'

interface EvidenceBoxProps {
  taskId: string
  evidence: TaskEvidence[]
  onUpdate: () => Promise<void>
}

const MAX_FILES = 20

export function EvidenceBox({ taskId, evidence, onUpdate }: EvidenceBoxProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    await handleFiles(files)
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFiles = async (files: File[]) => {
    // Check max files
    if (evidence.length + files.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} filer per uppgift`)
      return
    }

    // Validate files
    for (const file of files) {
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
      // Upload each file and link to task
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', 'BEVIS') // Default to evidence category

        const result = await uploadFileAndLinkToTask(formData, taskId)
        if (!result.success) {
          toast.error(`Kunde inte ladda upp ${file.name}: ${result.error}`)
        }
      }

      toast.success(
        files.length === 1
          ? 'Filen har laddats upp'
          : `${files.length} filer har laddats upp`
      )
      await onUpdate()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ett fel uppstod vid uppladdning')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (evidenceItem: TaskEvidence) => {
    setDownloadingId(evidenceItem.id)

    try {
      const result = await getFileDownloadUrl(evidenceItem.file_id)
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

  const handleUnlink = async (evidenceItem: TaskEvidence) => {
    setDeletingId(evidenceItem.id)

    try {
      // Unlink file from task (doesn't delete the file itself)
      const result = await unlinkFile(evidenceItem.file_id, 'task', taskId)
      if (result.success) {
        toast.success('Filen har tagits bort från uppgiften')
        await onUpdate()
      } else {
        toast.error(result.error || 'Kunde inte ta bort länken')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDelete = async (evidenceItem: TaskEvidence) => {
    setDeletingId(evidenceItem.id)

    try {
      // Delete the file completely (from storage and database)
      const result = await deleteFile(evidenceItem.file_id)
      if (result.success) {
        toast.success('Filen har raderats')
        await onUpdate()
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

  // Handle file picker selection
  const handlePickerSelect = async (fileIds: string[]) => {
    if (fileIds.length === 0) return

    try {
      const result = await linkFilesToTask(fileIds, taskId)
      if (result.success) {
        toast.success(
          fileIds.length === 1
            ? 'Filen har lagts till'
            : `${fileIds.length} filer har lagts till`
        )
        await onUpdate()
      } else {
        toast.error(result.error || 'Kunde inte länka filer')
      }
    } catch (error) {
      console.error('Link files error:', error)
      toast.error('Ett fel uppstod')
    }
  }

  // Get IDs of already linked files for the picker
  const linkedFileIds = evidence.map((e) => e.file_id)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Bevis</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilePicker(true)}
              className="h-7 text-xs"
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Från Mina dokument
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Laddar upp...</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Dra och släpp filer här
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs mt-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  eller välj fil
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Max 25MB per fil. PDF, bilder, Office-dokument.
                </p>
              </>
            )}
          </div>

          {/* File list */}
          {evidence.length > 0 && (
            <div className="space-y-2">
              {evidence.map((file) => (
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

                    {/* Unlink (remove from task but keep file) */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Ta bort från uppgift"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ta bort fil?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Filen tas bort från denna uppgift men finns kvar i
                            Mina dokument.
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
                          title="Radera fil permanent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Radera fil permanent?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Filen &quot;{file.filename}&quot; kommer raderas
                            permanent och tas bort från alla uppgifter och lagar
                            den är länkad till. Detta kan inte ångras.
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
                            Radera permanent
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {evidence.length === 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
              <Paperclip className="h-3 w-3" />
              Inga bifogade filer
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  )
}

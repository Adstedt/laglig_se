'use client'

/**
 * Story 6.6: Evidence Box
 * File upload and management for task evidence
 * TODO: Implement file upload to Supabase Storage
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
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskEvidence } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface EvidenceBoxProps {
  taskId: string
  evidence: TaskEvidence[]
  onUpdate: () => Promise<void>
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_FILES = 20
const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className="h-4 w-4" aria-hidden="true" />
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-500" aria-hidden="true" />
  }
  return <File className="h-4 w-4" aria-hidden="true" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EvidenceBox({
  taskId: _taskId,
  evidence,
  onUpdate: _onUpdate,
}: EvidenceBoxProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

    // TODO: Implement actual file upload to Supabase Storage
    // For now, just show a placeholder message
    toast.info('Filuppladdning kommer snart', {
      description: 'Denna funktion implementeras i en kommande version',
    })

    setIsUploading(false)
  }

  const handleDelete = async (evidenceId: string) => {
    setDeletingId(evidenceId)

    // TODO: Implement delete via server action
    toast.info('Raderingsfunktion kommer snart')

    setDeletingId(null)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Bevis</CardTitle>
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
                    // TODO: Implement download
                    onClick={() => toast.info('Nedladdning kommer snart')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Radera fil?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Är du säker på att du vill radera {file.filename}?
                          Detta kan inte ångras.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(file.id)}
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
  )
}

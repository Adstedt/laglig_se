'use client'

/**
 * Story 6.7a: File Dropzone
 * Reusable drag-and-drop file upload component
 * Uses native HTML5 drag-and-drop (NOT react-dropzone)
 */

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ============================================================================
// Constants (shared across file components)
// ============================================================================

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const MAX_FILES = 20

export const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export const ACCEPT_STRING = ACCEPTED_TYPES.join(',')

// ============================================================================
// Utilities (shared)
// ============================================================================

export function getFileIcon(mimeType: string | null, className?: string) {
  const iconClass = cn('h-4 w-4', className)

  // Default icon for folders or unknown types
  if (!mimeType) {
    return <File className={iconClass} aria-hidden="true" />
  }

  if (mimeType.startsWith('image/')) {
    return <ImageIcon className={iconClass} aria-hidden="true" />
  }
  if (mimeType === 'application/pdf') {
    return (
      <FileText className={cn(iconClass, 'text-red-500')} aria-hidden="true" />
    )
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return (
      <FileSpreadsheet
        className={cn(iconClass, 'text-green-600')}
        aria-hidden="true"
      />
    )
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return (
      <FileText
        className={cn(iconClass, 'text-orange-500')}
        aria-hidden="true"
      />
    )
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <FileText className={cn(iconClass, 'text-blue-600')} aria-hidden="true" />
    )
  }
  return <File className={iconClass} aria-hidden="true" />
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return 'Mapp' // Folders don't have size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateFile(
  file: File,
  options?: { maxSize?: number; acceptedTypes?: string[] }
): { valid: boolean; error?: string } {
  const maxSize = options?.maxSize ?? MAX_FILE_SIZE
  const acceptedTypes = options?.acceptedTypes ?? ACCEPTED_TYPES

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `${file.name} är för stor (max ${formatFileSize(maxSize)})`,
    }
  }

  if (!acceptedTypes.includes(file.type)) {
    return { valid: false, error: `${file.name} - filtypen stöds inte` }
  }

  return { valid: true }
}

// ============================================================================
// Types
// ============================================================================

export interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

export interface FileDropzoneProps {
  onUpload: (_files: File[]) => Promise<void>
  maxFiles?: number
  maxSize?: number
  acceptedTypes?: string[]
  currentFileCount?: number
  disabled?: boolean
  className?: string
  variant?: 'default' | 'compact'
  showProgress?: boolean
  /** Story 6.7b: Current folder name to display upload destination */
  folderName?: string | null
}

// ============================================================================
// Component
// ============================================================================

export function FileDropzone({
  onUpload,
  maxFiles = MAX_FILES,
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = ACCEPTED_TYPES,
  currentFileCount = 0,
  disabled = false,
  className,
  variant = 'default',
  showProgress = false,
  folderName,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled && !isUploading) {
        setIsDragging(true)
      }
    },
    [disabled, isUploading]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled || isUploading) return

      const files = Array.from(e.dataTransfer.files)
      await handleFiles(files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      disabled,
      isUploading,
      currentFileCount,
      maxFiles,
      maxSize,
      acceptedTypes,
      onUpload,
    ]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      await handleFiles(files)
      // Reset input to allow re-selecting same file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFileCount, maxFiles, maxSize, acceptedTypes, onUpload]
  )

  const handleFiles = async (files: File[]) => {
    // Check max files limit
    if (currentFileCount + files.length > maxFiles) {
      toast.error(`Max ${maxFiles} filer totalt`)
      return
    }

    // Validate each file
    const validFiles: File[] = []
    for (const file of files) {
      const validation = validateFile(file, { maxSize, acceptedTypes })
      if (!validation.valid) {
        toast.error(validation.error)
        return
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    setIsUploading(true)

    // Initialize progress tracking if enabled
    if (showProgress) {
      setUploadingFiles(
        validFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          progress: 0,
          status: 'pending',
        }))
      )
    }

    try {
      await onUpload(validFiles)
      toast.success(
        validFiles.length === 1
          ? 'Filen har laddats upp'
          : `${validFiles.length} filer har laddats upp`
      )
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Kunde inte ladda upp filen')
    } finally {
      setIsUploading(false)
      setUploadingFiles([])
    }
  }

  const cancelUpload = useCallback(() => {
    // Note: In a real implementation, this would abort the XHR/fetch request
    setIsUploading(false)
    setUploadingFiles([])
    toast.info('Uppladdning avbruten')
  }, [])

  const isCompact = variant === 'compact'

  return (
    <div
      data-testid="dropzone"
      className={cn(
        'border-2 border-dashed rounded-lg transition-colors',
        isCompact ? 'p-3' : 'p-4',
        isDragging ? 'border-primary bg-primary/5' : 'border-muted',
        (isUploading || disabled) && 'pointer-events-none opacity-50',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
        disabled={disabled || isUploading}
      />

      {isUploading ? (
        <div
          className={cn(
            'flex flex-col items-center gap-2',
            isCompact && 'gap-1'
          )}
        >
          <Loader2
            className={cn(
              'animate-spin text-primary',
              isCompact ? 'h-6 w-6' : 'h-8 w-8'
            )}
          />
          <p
            className={cn(
              'text-muted-foreground',
              isCompact ? 'text-xs' : 'text-sm'
            )}
          >
            Laddar upp...
          </p>

          {/* Progress display */}
          {showProgress && uploadingFiles.length > 0 && (
            <div className="w-full space-y-2 mt-2">
              {uploadingFiles.map((uf) => (
                <div key={uf.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[200px]">
                      {uf.file.name}
                    </span>
                    <span>{Math.round(uf.progress)}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uf.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cancel button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelUpload}
            className="text-xs mt-1"
          >
            <X className="h-3 w-3 mr-1" />
            Avbryt
          </Button>
        </div>
      ) : (
        <div className={cn('text-center', isCompact && 'space-y-1')}>
          <Upload
            className={cn(
              'mx-auto text-muted-foreground/50',
              isCompact ? 'h-6 w-6 mb-1' : 'h-8 w-8 mb-2'
            )}
          />
          <p
            className={cn(
              'text-muted-foreground',
              isCompact ? 'text-xs' : 'text-sm'
            )}
          >
            {isCompact
              ? 'Dra filer hit'
              : folderName
                ? `Ladda upp till "${folderName}"`
                : 'Dra och släpp filer här'}
          </p>
          <Button
            variant="link"
            size="sm"
            className={cn(
              isCompact ? 'text-xs h-auto p-0 mt-0' : 'text-xs mt-1'
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            eller välj fil
          </Button>
          {!isCompact && (
            <p className="text-xs text-muted-foreground mt-2">
              Max {formatFileSize(maxSize)} per fil. PDF, bilder,
              Office-dokument.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

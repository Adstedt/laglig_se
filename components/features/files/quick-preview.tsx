'use client'

/**
 * Story 6.7b: Quick Preview (Spacebar)
 * AC: 21, 22, 23, 24 - macOS Quick Look style preview overlay
 */

import { useEffect, useCallback, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImagePreview } from './preview/image-preview'
import { PdfPreview } from './preview/pdf-preview'
import { OfficeFallback } from './preview/office-preview'
import { getFileIcon } from './file-dropzone'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface QuickPreviewProps {
  file: WorkspaceFileWithLinks | null
  files: WorkspaceFileWithLinks[]
  open: boolean
  onClose: () => void
  onNavigate: (_file: WorkspaceFileWithLinks) => void
  getFileUrl: (_file: WorkspaceFileWithLinks) => Promise<string | null>
  onDownload?: (_file: WorkspaceFileWithLinks) => void
}

// ============================================================================
// Quick Preview Component
// ============================================================================

export function QuickPreview({
  file,
  files,
  open,
  onClose,
  onNavigate,
  getFileUrl,
  onDownload,
}: QuickPreviewProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

  // Get current file index
  const currentIndex = file ? files.findIndex((f) => f.id === file.id) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < files.length - 1

  // Load file URL when file changes
  useEffect(() => {
    if (!file || !open) {
      setFileUrl(null)
      return
    }

    setIsLoadingUrl(true)
    getFileUrl(file).then((url) => {
      setFileUrl(url)
      setIsLoadingUrl(false)
    })
  }, [file, open, getFileUrl])

  // Navigate to previous file
  const goToPrev = useCallback(() => {
    const prevFile = files[currentIndex - 1]
    if (hasPrev && prevFile) {
      onNavigate(prevFile)
    }
  }, [hasPrev, currentIndex, files, onNavigate])

  // Navigate to next file
  const goToNext = useCallback(() => {
    const nextFile = files[currentIndex + 1]
    if (hasNext && nextFile) {
      onNavigate(nextFile)
    }
  }, [hasNext, currentIndex, files, onNavigate])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goToPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
        case ' ':
          // Prevent spacebar from reopening when already open
          e.preventDefault()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, goToPrev, goToNext])

  if (!open || !file) return null

  const isImage = file.mime_type?.startsWith('image/')
  const isPdf = file.mime_type === 'application/pdf'
  const isOffice =
    file.mime_type?.includes('word') ||
    file.mime_type?.includes('excel') ||
    file.mime_type?.includes('spreadsheet') ||
    file.mime_type?.includes('powerpoint') ||
    file.mime_type?.includes('presentation')

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Förhandsgranska fil"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Content - stopPropagation prevents closing when clicking inside */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="document"
        className="relative z-10 w-full max-w-4xl max-h-[90vh] m-4 bg-background rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            {getFileIcon(file.mime_type)}
            <span className="font-medium truncate">{file.filename}</span>
          </div>
          <div className="flex items-center gap-1">
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(file)}
                className="h-8 w-8 p-0"
                title="Ladda ner"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              title="Stäng (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto min-h-[300px] relative">
          {isLoadingUrl ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground">
                Laddar förhandsgranskning...
              </div>
            </div>
          ) : !fileUrl ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8">
              {getFileIcon(file.mime_type)}
              <p>Kunde inte ladda förhandsgranskning</p>
              {onDownload && (
                <Button variant="outline" onClick={() => onDownload(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Ladda ner
                </Button>
              )}
            </div>
          ) : isImage ? (
            <div className="h-full p-4">
              <ImagePreview url={fileUrl} alt={file.filename} />
            </div>
          ) : isPdf ? (
            <PdfPreview
              url={fileUrl}
              filename={file.filename}
              onOpenInNewTab={() => window.open(fileUrl, '_blank')}
            />
          ) : isOffice ? (
            <OfficeFallback
              mimeType={file.mime_type || ''}
              onDownload={onDownload ? () => onDownload(file) : undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8">
              {getFileIcon(file.mime_type)}
              <p className="text-center">
                Förhandsgranskning inte tillgänglig för denna filtyp
              </p>
              {onDownload && (
                <Button variant="outline" onClick={() => onDownload(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Ladda ner
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Navigation arrows (only if multiple files) */}
        {files.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 p-0 rounded-full bg-background/80 hover:bg-background shadow-lg',
                !hasPrev && 'opacity-30 cursor-not-allowed'
              )}
              onClick={goToPrev}
              disabled={!hasPrev}
              title="Föregående (←)"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 p-0 rounded-full bg-background/80 hover:bg-background shadow-lg',
                !hasNext && 'opacity-30 cursor-not-allowed'
              )}
              onClick={goToNext}
              disabled={!hasNext}
              title="Nästa (→)"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Footer with file count */}
        {files.length > 1 && (
          <div className="px-4 py-2 border-t text-center text-sm text-muted-foreground">
            {currentIndex + 1} av {files.length}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Quick Preview Hook (for spacebar activation)
// ============================================================================

export function useQuickPreview(
  selectedFile: WorkspaceFileWithLinks | null,
  enabled: boolean = true
) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!enabled || !selectedFile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on spacebar when not in an input
      if (
        e.key === ' ' &&
        !isOpen &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, selectedFile, isOpen])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}

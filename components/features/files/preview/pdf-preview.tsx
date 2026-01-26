'use client'

/**
 * Story 6.7b: PDF Preview
 * AC: 18 - PDF page viewer with navigation and zoom
 */

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Must use dynamic import with ssr: false for react-pdf
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false, loading: () => <Skeleton className="w-[400px] h-[500px]" /> }
)
const Page = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})

// Note: react-pdf CSS is imported in the root layout or global styles
// to avoid SSR issues with dynamic imports

// ============================================================================
// Types
// ============================================================================

interface PdfPreviewProps {
  url: string
  filename: string
  onOpenInNewTab?: () => void
  className?: string
}

type LoadError = {
  message?: string
  name?: string
}

// ============================================================================
// PDF Preview Component
// ============================================================================

export function PdfPreview({
  url,
  filename: _filename,
  onOpenInNewTab,
  className,
}: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordProtected, setIsPasswordProtected] = useState(false)
  const [isWorkerReady, setIsWorkerReady] = useState(false)

  // Configure PDF.js worker on client-side only
  useEffect(() => {
    const setupWorker = async () => {
      try {
        const { pdfjs } = await import('react-pdf')
        // Use local worker file copied to public folder
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        setIsWorkerReady(true)
      } catch (err) {
        console.error('Failed to setup PDF worker:', err)
        setError('Kunde inte ladda PDF-visaren')
      }
    }
    setupWorker()
  }, [])

  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      setIsLoading(false)
      setError(null)
    },
    []
  )

  const handleLoadError = useCallback((err: LoadError) => {
    setIsLoading(false)
    if (err.name === 'PasswordException') {
      setIsPasswordProtected(true)
      setError('PDF-filen är lösenordsskyddad')
    } else {
      setError('Kunde inte läsa in PDF-filen')
    }
  }, [])

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setIsPasswordProtected(false)
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(numPages, prev + 1))
  }, [numPages])

  const handlePageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      if (!isNaN(value) && value >= 1 && value <= numPages) {
        setPageNumber(value)
      }
    },
    [numPages]
  )

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(2, prev + 0.25))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, prev - 0.25))
  }, [])

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-2',
          className
        )}
      >
        {isPasswordProtected ? (
          <Lock className="h-12 w-12" />
        ) : (
          <AlertCircle className="h-12 w-12" />
        )}
        <p className="font-medium">{error}</p>
        {!isPasswordProtected && (
          <>
            <p className="text-sm text-center max-w-[250px]">
              PDF-filen kunde inte laddas. Kontrollera att filen är giltig.
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Försök igen
            </Button>
          </>
        )}
        {onOpenInNewTab && (
          <Button variant="outline" size="sm" onClick={onOpenInNewTab}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ladda ner för att visa
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <span>Sida</span>
            <Input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={handlePageInput}
              className="w-12 h-7 text-center p-1"
            />
            <span>av {numPages || '?'}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom and actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8 p-0"
            title="Zooma ut"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2}
            className="h-8 w-8 p-0"
            title="Zooma in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {onOpenInNewTab && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenInNewTab}
              className="ml-2"
              title="Öppna i ny flik"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Öppna</span>
            </Button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/10">
        {(isLoading || !isWorkerReady) && (
          <Skeleton className="w-[400px] h-[500px]" />
        )}
        {isWorkerReady && (
          <Document
            file={url}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={null}
            className={cn(isLoading && 'hidden')}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// PDF Thumbnail (for compact preview)
// ============================================================================

export function PdfThumbnail({
  url,
  className,
}: {
  url: string
  className?: string
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isWorkerReady, setIsWorkerReady] = useState(false)

  // Configure PDF.js worker on client-side only
  useEffect(() => {
    const setupWorker = async () => {
      try {
        const { pdfjs } = await import('react-pdf')
        // Use local worker file copied to public folder
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        setIsWorkerReady(true)
      } catch {
        setError(true)
      }
    }
    setupWorker()
  }, [])

  return (
    <div className={cn('relative', className)}>
      {(isLoading || !isWorkerReady) && !error && (
        <Skeleton className="absolute inset-0" />
      )}
      {error ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
      ) : isWorkerReady ? (
        <Document
          file={url}
          onLoadSuccess={() => setIsLoading(false)}
          onLoadError={() => {
            setIsLoading(false)
            setError(true)
          }}
          loading={null}
        >
          <Page
            pageNumber={1}
            width={128}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      ) : null}
    </div>
  )
}

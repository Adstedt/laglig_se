'use client'

/**
 * Story 6.7b: Image Preview with Zoom
 * AC: 17, 22, 23 - Zoomable image viewer with pan/pinch controls
 */

import { useState, useCallback } from 'react'
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from 'react-zoom-pan-pinch'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface ImagePreviewProps {
  url: string
  alt: string
  onFullscreen?: () => void
  className?: string
}

// ============================================================================
// Zoom Controls Component
// ============================================================================

function ZoomControls({
  onFullscreen,
}: {
  onFullscreen?: (() => void) | undefined
}) {
  const { zoomIn, zoomOut, resetTransform } = useControls()

  return (
    <div className="absolute top-2 right-2 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1 z-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => zoomIn()}
        className="h-8 w-8 p-0"
        title="Zooma in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => zoomOut()}
        className="h-8 w-8 p-0"
        title="Zooma ut"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => resetTransform()}
        className="h-8 w-8 p-0"
        title="Återställ"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      {onFullscreen && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onFullscreen}
          className="h-8 w-8 p-0"
          title="Helskärm"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ============================================================================
// Image Preview Component
// ============================================================================

export function ImagePreview({
  url,
  alt,
  onFullscreen,
  className,
}: ImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setError('Kunde inte läsa in bilden')
  }, [])

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    // Force reload by appending timestamp
    const img = document.querySelector(`img[src="${url}"]`) as HTMLImageElement
    if (img) {
      const newUrl = url.includes('?')
        ? `${url}&_t=${Date.now()}`
        : `${url}?_t=${Date.now()}`
      img.src = newUrl
    }
  }, [url])

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground gap-2',
          className
        )}
      >
        <AlertCircle className="h-12 w-12" />
        <p className="font-medium">Kunde inte läsa in bilden</p>
        <p className="text-sm text-center max-w-[250px]">
          Bilden kunde inte laddas. Kontrollera din anslutning och försök igen.
        </p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Försök igen
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full h-full min-h-[200px]', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full min-h-[200px]" />
        </div>
      )}

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ mode: 'toggle' }}
      >
        <ZoomControls onFullscreen={onFullscreen} />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass="w-full h-full flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'max-h-[400px] max-w-full w-auto h-auto object-contain transition-opacity',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

// ============================================================================
// Compact Image Preview (for thumbnails/hover)
// ============================================================================

export function ImagePreviewCompact({
  url,
  alt,
  className,
}: Omit<ImagePreviewProps, 'onFullscreen'>) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <div className={cn('relative w-full h-full', className)}>
      {isLoading && !error && <Skeleton className="absolute inset-0" />}
      {error ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setError(true)
          }}
          className={cn(
            'w-full h-full object-cover transition-opacity',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
    </div>
  )
}

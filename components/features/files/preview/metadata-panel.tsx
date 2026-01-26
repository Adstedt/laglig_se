'use client'

/**
 * Story 6.7b: Extended Metadata Display
 * AC: 25, 26 - File metadata with EXIF extraction for images
 */

import { useState, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Camera,
  Calendar,
  Ruler,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import EXIF from 'exif-js'

// ============================================================================
// Types
// ============================================================================

interface MetadataPanelProps {
  file: {
    filename: string
    original_filename?: string | null
    file_size?: number | null
    mime_type?: string | null
    created_at: Date
    updated_at: Date
  }
  imageUrl?: string | undefined // For EXIF extraction
  pdfPageCount?: number | undefined
  imageDimensions?: { width: number; height: number } | undefined
  className?: string
}

interface ExifData {
  camera?: string | undefined
  dateTaken?: string | undefined
  gpsLatitude?: number | undefined
  gpsLongitude?: number | undefined
  orientation?: number | undefined
  exposureTime?: string | undefined
  fNumber?: string | undefined
  iso?: number | undefined
  focalLength?: string | undefined
}

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Convert GPS coordinates from DMS to decimal degrees
function convertDMSToDD(
  dms: number[] | undefined,
  ref: string | undefined
): number | undefined {
  if (!dms || dms.length < 3) return undefined
  const d0 = dms[0] ?? 0
  const d1 = dms[1] ?? 0
  const d2 = dms[2] ?? 0
  const degrees = d0 + d1 / 60 + d2 / 3600
  return ref === 'S' || ref === 'W' ? -degrees : degrees
}

// ============================================================================
// EXIF Extraction Hook
// ============================================================================

function useExifData(imageUrl?: string): {
  data: ExifData | null
  isLoading: boolean
} {
  const [data, setData] = useState<ExifData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!imageUrl) {
      setData(null)
      return
    }

    setIsLoading(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = function () {
      // @ts-expect-error - EXIF.getData uses 'this' binding
      EXIF.getData(img, function () {
        // @ts-expect-error - EXIF types are incomplete
        const allTags = EXIF.getAllTags(this)

        if (!allTags || Object.keys(allTags).length === 0) {
          setData(null)
          setIsLoading(false)
          return
        }

        const exifData: ExifData = {
          camera: allTags.Model
            ? `${allTags.Make || ''} ${allTags.Model}`.trim()
            : undefined,
          dateTaken: allTags.DateTimeOriginal,
          gpsLatitude: convertDMSToDD(
            allTags.GPSLatitude,
            allTags.GPSLatitudeRef
          ),
          gpsLongitude: convertDMSToDD(
            allTags.GPSLongitude,
            allTags.GPSLongitudeRef
          ),
          orientation: allTags.Orientation,
          exposureTime: allTags.ExposureTime
            ? `1/${Math.round(1 / allTags.ExposureTime)}s`
            : undefined,
          fNumber: allTags.FNumber ? `f/${allTags.FNumber}` : undefined,
          iso: allTags.ISOSpeedRatings,
          focalLength: allTags.FocalLength
            ? `${allTags.FocalLength}mm`
            : undefined,
        }

        setData(exifData)
        setIsLoading(false)
      })
    }

    img.onerror = () => {
      setData(null)
      setIsLoading(false)
    }

    img.src = imageUrl
  }, [imageUrl])

  return { data, isLoading }
}

// ============================================================================
// Metadata Row Component
// ============================================================================

function MetadataRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number | undefined | null
  icon?: React.ReactNode
}) {
  if (!value) return null

  return (
    <div className="flex items-start gap-2 py-1">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm truncate">{value}</dd>
      </div>
    </div>
  )
}

// ============================================================================
// Metadata Panel Component
// ============================================================================

export function MetadataPanel({
  file,
  imageUrl,
  pdfPageCount,
  imageDimensions,
  className,
}: MetadataPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: exifData, isLoading: isLoadingExif } = useExifData(
    imageUrl && file.mime_type?.startsWith('image/') ? imageUrl : undefined
  )

  const isImage = file.mime_type?.startsWith('image/')
  const isPdf = file.mime_type === 'application/pdf'
  const hasExif =
    exifData && Object.values(exifData).some((v) => v !== undefined)
  const hasLocation = exifData?.gpsLatitude && exifData?.gpsLongitude

  return (
    <div className={cn('border-t', className)}>
      {/* Basic metadata (always visible) */}
      <dl className="p-4 space-y-1">
        <MetadataRow label="Filnamn" value={file.filename} />
        {file.original_filename && file.original_filename !== file.filename && (
          <MetadataRow
            label="Ursprungligt namn"
            value={file.original_filename}
          />
        )}
        <MetadataRow label="Storlek" value={formatFileSize(file.file_size)} />
        <MetadataRow label="Typ" value={file.mime_type} />
        <MetadataRow label="Uppladdad" value={formatDate(file.created_at)} />
        {file.updated_at !== file.created_at && (
          <MetadataRow label="Ändrad" value={formatDate(file.updated_at)} />
        )}

        {/* Image dimensions */}
        {imageDimensions && (
          <MetadataRow
            label="Dimensioner"
            value={`${imageDimensions.width} × ${imageDimensions.height} px`}
            icon={<Ruler className="h-3.5 w-3.5" />}
          />
        )}

        {/* PDF page count */}
        {isPdf && pdfPageCount && (
          <MetadataRow label="Antal sidor" value={pdfPageCount} />
        )}
      </dl>

      {/* Extended metadata (collapsible) */}
      {(isImage || hasExif) && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-4 py-2 h-auto font-normal border-t rounded-none"
            >
              <span className="text-sm">Egenskaper</span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="p-4 space-y-1 bg-muted/30">
              {isLoadingExif ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : hasExif ? (
                <>
                  {exifData?.camera && (
                    <MetadataRow
                      label="Kamera"
                      value={exifData.camera}
                      icon={<Camera className="h-3.5 w-3.5" />}
                    />
                  )}
                  {exifData?.dateTaken && (
                    <MetadataRow
                      label="Datum taget"
                      value={exifData.dateTaken}
                      icon={<Calendar className="h-3.5 w-3.5" />}
                    />
                  )}
                  {hasLocation && (
                    <MetadataRow
                      label="Plats"
                      value={`${exifData.gpsLatitude?.toFixed(6)}, ${exifData.gpsLongitude?.toFixed(6)}`}
                      icon={<MapPin className="h-3.5 w-3.5" />}
                    />
                  )}
                  {exifData?.exposureTime && (
                    <MetadataRow
                      label="Exponeringstid"
                      value={exifData.exposureTime}
                    />
                  )}
                  {exifData?.fNumber && (
                    <MetadataRow label="Bländare" value={exifData.fNumber} />
                  )}
                  {exifData?.iso && (
                    <MetadataRow label="ISO" value={exifData.iso} />
                  )}
                  {exifData?.focalLength && (
                    <MetadataRow
                      label="Brännvidd"
                      value={exifData.focalLength}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Ingen EXIF-data tillgänglig
                </p>
              )}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

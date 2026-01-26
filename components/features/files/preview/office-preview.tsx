'use client'

/**
 * Story 6.7b: Office Document Preview
 * AC: 19 - Word, Excel, PowerPoint preview
 *
 * Note: react-office-viewer has compatibility issues with Turbopack.
 * Using Microsoft Office Online Viewer (iframe) as fallback, which requires
 * publicly accessible URLs. For private files, shows download fallback.
 */

import { useState } from 'react'
import {
  AlertCircle,
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface OfficePreviewProps {
  url: string
  filename: string
  mimeType: string
  onDownload?: () => void
  className?: string
}

type OfficeFileType = 'word' | 'excel' | 'powerpoint' | 'unknown'

// ============================================================================
// Helpers
// ============================================================================

function getOfficeFileType(mimeType: string): OfficeFileType {
  if (
    mimeType === 'application/msword' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'word'
  }
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'excel'
  }
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'powerpoint'
  }
  return 'unknown'
}

function getOfficeIcon(fileType: OfficeFileType) {
  switch (fileType) {
    case 'word':
      return <FileText className="h-12 w-12 text-blue-600" />
    case 'excel':
      return <FileSpreadsheet className="h-12 w-12 text-green-600" />
    case 'powerpoint':
      return <Presentation className="h-12 w-12 text-orange-600" />
    default:
      return <FileText className="h-12 w-12 text-muted-foreground" />
  }
}

function getOfficeLabel(fileType: OfficeFileType): string {
  switch (fileType) {
    case 'word':
      return 'Word-dokument'
    case 'excel':
      return 'Excel-kalkylblad'
    case 'powerpoint':
      return 'PowerPoint-presentation'
    default:
      return 'Office-dokument'
  }
}

// ============================================================================
// Office Preview Component
// Uses Microsoft Office Online Viewer for public URLs
// ============================================================================

export function OfficePreview({
  url,
  filename: _filename,
  mimeType,
  onDownload,
  className,
}: OfficePreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const fileType = getOfficeFileType(mimeType)

  // Unsupported file type fallback
  if (fileType === 'unknown') {
    return (
      <OfficeFallback
        mimeType={mimeType}
        onDownload={onDownload}
        className={className}
      />
    )
  }

  // Check if URL is likely to work with Microsoft's viewer
  // Microsoft Office Online Viewer requires publicly accessible URLs
  // Supabase signed URLs may not work due to CORS/authentication
  const isPublicUrl = url.startsWith('http://') || url.startsWith('https://')
  const canUseOnlineViewer =
    isPublicUrl && !url.includes('token=') && !url.includes('sig=')

  // For private/signed URLs, show fallback with download option
  if (!canUseOnlineViewer) {
    return (
      <OfficeFallback
        mimeType={mimeType}
        onDownload={onDownload}
        className={className}
      />
    )
  }

  // Microsoft Office Online Viewer URL
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-2',
          className
        )}
      >
        <AlertCircle className="h-12 w-12" />
        <p className="font-medium">Kunde inte läsa in dokumentet</p>
        <p className="text-sm text-center max-w-[250px]">
          Microsoft Office Online kunde inte visa filen.
        </p>
        {onDownload && (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Ladda ner för att visa
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('relative h-full min-h-[400px]', className)}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Skeleton className="h-[300px] w-full" />
          <div className="flex items-center gap-2 text-muted-foreground">
            {getOfficeIcon(fileType)}
            <span className="text-sm">
              Laddar {getOfficeLabel(fileType)}...
            </span>
          </div>
        </div>
      )}
      <iframe
        src={viewerUrl}
        width="100%"
        height="400"
        frameBorder="0"
        title={`${getOfficeLabel(fileType)} förhandsgranskning`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setError(true)
        }}
        className={cn(isLoading && 'invisible')}
      />
    </div>
  )
}

// ============================================================================
// Office Fallback (for unsupported preview or private files)
// ============================================================================

export function OfficeFallback({
  mimeType,
  onDownload,
  className,
}: {
  mimeType: string
  onDownload?: (() => void) | undefined
  className?: string | undefined
}) {
  const fileType = getOfficeFileType(mimeType)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground gap-4 p-6',
        className
      )}
    >
      {getOfficeIcon(fileType)}
      <div className="text-center">
        <p className="font-medium">{getOfficeLabel(fileType)}</p>
        <p className="text-sm mt-1">
          Förhandsgranskning ej tillgänglig för denna fil
        </p>
      </div>
      <div className="flex gap-2">
        {onDownload && (
          <Button variant="outline" onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            Ladda ner
          </Button>
        )}
        {onDownload && (
          <Button variant="ghost" onClick={onDownload}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Öppna
          </Button>
        )}
      </div>
    </div>
  )
}

'use client'

/**
 * Story 6.7a: File Card
 * Grid view card for workspace files - Dropbox-inspired design
 */

import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Presentation,
} from 'lucide-react'
import { formatFileSize } from './file-dropzone'
import type { FileCategory } from '@prisma/client'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Truncate filename in the middle, preserving start and extension
 * e.g., "Resultatrapport_20210101-20211231_Monthly.pdf" -> "Resultatrapport_202...nthly.pdf"
 */
function truncateMiddle(filename: string, maxLength: number = 28): string {
  if (filename.length <= maxLength) return filename

  const extMatch = filename.match(/\.[^.]+$/)
  const ext = extMatch ? extMatch[0] : ''
  const nameWithoutExt = ext ? filename.slice(0, -ext.length) : filename

  // Keep more of the start, less of the end (before extension)
  const availableLength = maxLength - ext.length - 3 // 3 for "..."
  const startLength = Math.ceil(availableLength * 0.65)
  const endLength = Math.floor(availableLength * 0.35)

  const start = nameWithoutExt.slice(0, startLength)
  const end = nameWithoutExt.slice(-endLength)

  return `${start}...${end}${ext}`
}

// ============================================================================
// Category Configuration
// ============================================================================

export const categoryLabels: Record<FileCategory, string> = {
  BEVIS: 'Bevis',
  POLICY: 'Policy',
  AVTAL: 'Avtal',
  CERTIFIKAT: 'Certifikat',
  OVRIGT: 'Övrigt',
}

export const categoryColors: Record<FileCategory, string> = {
  BEVIS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  POLICY:
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  AVTAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CERTIFIKAT:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  OVRIGT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

// ============================================================================
// File Type Configuration - Dropbox-style extension badges
// ============================================================================

interface FileTypeConfig {
  label: string
  bgColor: string
  textColor: string
  icon: React.ReactNode
}

function getFileTypeConfig(mimeType: string, filename: string): FileTypeConfig {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  // PDF
  if (mimeType === 'application/pdf') {
    return {
      label: 'PDF',
      bgColor: 'bg-red-500',
      textColor: 'text-white',
      icon: <FileText className="h-8 w-8 text-red-500" />,
    }
  }

  // Excel / Spreadsheet
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv'
  ) {
    return {
      label: ext.toUpperCase() || 'XLSX',
      bgColor: 'bg-green-600',
      textColor: 'text-white',
      icon: <FileSpreadsheet className="h-8 w-8 text-green-600" />,
    }
  }

  // PowerPoint / Presentation
  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    ext === 'pptx' ||
    ext === 'ppt'
  ) {
    return {
      label: ext.toUpperCase() || 'PPTX',
      bgColor: 'bg-orange-500',
      textColor: 'text-white',
      icon: <Presentation className="h-8 w-8 text-orange-500" />,
    }
  }

  // Word / Document
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    return {
      label: ext.toUpperCase() || 'DOCX',
      bgColor: 'bg-blue-600',
      textColor: 'text-white',
      icon: <FileText className="h-8 w-8 text-blue-600" />,
    }
  }

  // Images
  if (mimeType.startsWith('image/')) {
    const imgExt = ext.toUpperCase() || mimeType.split('/')[1]?.toUpperCase()
    return {
      label: imgExt || 'IMG',
      bgColor: 'bg-purple-500',
      textColor: 'text-white',
      icon: <ImageIcon className="h-8 w-8 text-purple-500" />,
    }
  }

  // Default
  return {
    label: ext.toUpperCase() || 'FILE',
    bgColor: 'bg-gray-500',
    textColor: 'text-white',
    icon: <File className="h-8 w-8 text-gray-500" />,
  }
}

// ============================================================================
// Types
// ============================================================================

interface FileCardProps {
  file: WorkspaceFileWithLinks
  selected?: boolean
  onSelect?: (_fileId: string, _selected: boolean) => void
  onClick?: (_file: WorkspaceFileWithLinks) => void
  showSelection?: boolean
  // Drag and drop props
  draggable?: boolean
  isDragging?: boolean
  onDragStart?: (_e: React.DragEvent) => void
  onDragEnd?: () => void
}

// ============================================================================
// Component - Dropbox-inspired design
// ============================================================================

export function FileCard({
  file,
  selected = false,
  onSelect,
  onClick,
  showSelection = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: FileCardProps) {
  const fileTypeConfig = getFileTypeConfig(file.mime_type, file.filename)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    onClick?.(file)
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(file.id, checked)
  }

  return (
    <Card
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group cursor-pointer transition-all duration-200 aspect-square',
        'hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5',
        'border-transparent',
        selected && 'ring-2 ring-primary border-primary shadow-md',
        isDragging && 'opacity-50 scale-95'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-0 h-full flex flex-col">
        {/* Thumbnail / Preview area - takes most of the square */}
        <div className="relative flex-1 bg-gradient-to-br from-muted/50 to-muted rounded-t-lg overflow-hidden">
          {/* Selection checkbox */}
          {showSelection && (
            <div
              data-checkbox
              className={cn(
                'absolute top-3 left-3 z-10 transition-opacity',
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={handleCheckboxChange}
                aria-label={`Välj ${file.filename}`}
                className="h-5 w-5 bg-background/90 border-2"
              />
            </div>
          )}

          {/* File type icon - centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="scale-[2]">{fileTypeConfig.icon}</div>
          </div>

          {/* File type badge - bottom right corner */}
          <div className="absolute bottom-3 right-3">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide shadow-sm',
                fileTypeConfig.bgColor,
                fileTypeConfig.textColor
              )}
            >
              {fileTypeConfig.label}
            </span>
          </div>
        </div>

        {/* File info - fixed height at bottom */}
        <div className="p-3 space-y-0.5 flex-shrink-0">
          <p
            className="text-sm font-medium leading-tight"
            title={file.filename}
          >
            {truncateMiddle(file.filename)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.file_size)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Skeleton - Matches new Dropbox-inspired design
// ============================================================================

export function FileCardSkeleton() {
  return (
    <Card className="border-transparent aspect-square">
      <CardContent className="p-0 h-full flex flex-col">
        {/* Thumbnail skeleton */}
        <div className="flex-1 bg-muted rounded-t-lg animate-pulse" />

        {/* Info skeleton */}
        <div className="p-3 space-y-1.5 flex-shrink-0">
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

/**
 * Story 6.7a: File Card
 * Grid view card for workspace files
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getFileIcon, formatFileSize } from './file-dropzone'
import type { FileCategory } from '@prisma/client'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'

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
// Types
// ============================================================================

interface FileCardProps {
  file: WorkspaceFileWithLinks
  selected?: boolean
  onSelect?: (_fileId: string, _selected: boolean) => void
  onClick?: (_file: WorkspaceFileWithLinks) => void
  showSelection?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function FileCard({
  file,
  selected = false,
  onSelect,
  onClick,
  showSelection = false,
}: FileCardProps) {
  const isImage = file.mime_type.startsWith('image/')

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on checkbox
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    onClick?.(file)
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(file.id, checked)
  }

  const formattedDate = new Date(file.created_at).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const linkCount = file.task_links.length + file.list_item_links.length

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md',
        'hover:border-primary/50',
        selected && 'ring-2 ring-primary border-primary'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Header with checkbox and category */}
        <div className="flex items-start justify-between mb-2">
          {showSelection && (
            <div data-checkbox>
              <Checkbox
                checked={selected}
                onCheckedChange={handleCheckboxChange}
                aria-label={`Välj ${file.filename}`}
              />
            </div>
          )}
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] font-medium ml-auto',
              categoryColors[file.category]
            )}
          >
            {categoryLabels[file.category]}
          </Badge>
        </div>

        {/* File preview / icon */}
        <div className="flex justify-center items-center h-20 mb-3 bg-muted/30 rounded-md overflow-hidden">
          {isImage ? (
            // Image thumbnail - actual preview would require signed URL
            <div className="flex items-center justify-center w-full h-full">
              {getFileIcon(file.mime_type, 'h-10 w-10 text-muted-foreground')}
            </div>
          ) : (
            <div className="flex items-center justify-center">
              {getFileIcon(file.mime_type, 'h-10 w-10')}
            </div>
          )}
        </div>

        {/* File info */}
        <div className="space-y-1">
          <p className="text-sm font-medium truncate" title={file.filename}>
            {file.filename}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(file.file_size)}</span>
            <span>{formattedDate}</span>
          </div>

          {/* Link count indicator */}
          {linkCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Länkad till {linkCount} {linkCount === 1 ? 'objekt' : 'objekt'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Skeleton
// ============================================================================

export function FileCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          <div className="h-5 w-12 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-20 mb-3 bg-muted/50 rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          <div className="flex justify-between">
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

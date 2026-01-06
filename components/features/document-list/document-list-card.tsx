'use client'

/**
 * Story 4.11: Document List Card
 * Individual document card with drag handle, type badge, and actions
 */

import { forwardRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GripVertical, Trash2 } from 'lucide-react'
import {
  getContentTypeLabel,
  getContentTypeBadgeColor,
  getContentTypeIcon,
  getDocumentUrl,
} from '@/lib/utils/content-type'
import type { DocumentListItem } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

// Status display mapping
const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Ej påbörjad',
  IN_PROGRESS: 'Pågående',
  BLOCKED: 'Blockerad',
  REVIEW: 'Granskning',
  COMPLIANT: 'Uppfylld',
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  COMPLIANT: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medium',
  HIGH: 'Hög',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

interface DocumentListCardProps {
  item: DocumentListItem
  onRemove: () => void
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isRemoving?: boolean
}

export const DocumentListCard = forwardRef<HTMLDivElement, DocumentListCardProps>(
  function DocumentListCard(
    { item, onRemove, isDragging, dragHandleProps, isRemoving },
    ref
  ) {
    const TypeIcon = getContentTypeIcon(item.document.contentType)
    const documentUrl = getDocumentUrl(item.document.contentType, item.document.slug, true)

    return (
      <Card
        ref={ref}
        data-testid="document-card"
        className={cn(
          'group relative transition-shadow',
          isDragging && 'shadow-lg ring-2 ring-primary/20',
          isRemoving && 'opacity-50 pointer-events-none'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* Drag handle */}
            <button
              {...dragHandleProps}
              className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Dra för att ändra ordning"
            >
              <GripVertical className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0">
              <Link
                href={documentUrl}
                className="block hover:underline"
              >
                <h3 className="font-medium leading-snug line-clamp-2">
                  {item.document.title}
                </h3>
              </Link>
              <p className="text-sm text-muted-foreground mt-1">
                {item.document.documentNumber}
              </p>
            </div>

            {/* Content type badge */}
            <Badge
              variant="secondary"
              className={cn(
                'flex items-center gap-1 shrink-0',
                getContentTypeBadgeColor(item.document.contentType)
              )}
            >
              <TypeIcon className="h-3 w-3" />
              {getContentTypeLabel(item.document.contentType)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {/* Summary */}
          {item.document.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {item.document.summary}
            </p>
          )}

          {/* Commentary */}
          {item.commentary && (
            <p className="text-sm text-muted-foreground italic mb-3 border-l-2 pl-3">
              {item.commentary}
            </p>
          )}

          {/* Status and priority badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={STATUS_COLORS[item.status]}
            >
              {STATUS_LABELS[item.status]}
            </Badge>

            {item.priority !== 'MEDIUM' && (
              <Badge
                variant="secondary"
                className={PRIORITY_COLORS[item.priority]}
              >
                {PRIORITY_LABELS[item.priority]}
              </Badge>
            )}
          </div>

          {/* Remove button (visible on hover) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={onRemove}
                  disabled={isRemoving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ta bort från listan</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>
    )
  }
)

'use client'

/**
 * Story 4.11: Document List Card
 * Fixed-height card design with consistent sizing (Jira-style)
 */

import { forwardRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GripVertical, Trash2 } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { getDocumentUrl } from '@/lib/utils/content-type'
import type { DocumentListItem } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

// Status display mapping
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: 'Ej påbörjad',
    className:
      'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400',
  },
  IN_PROGRESS: {
    label: 'Pågående',
    className:
      'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400',
  },
  BLOCKED: {
    label: 'Blockerad',
    className:
      'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
  },
  REVIEW: {
    label: 'Granskning',
    className:
      'border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400',
  },
  COMPLIANT: {
    label: 'Uppfylld',
    className:
      'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400',
  },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  HIGH: {
    label: 'Hög',
    className:
      'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400',
  },
}

interface DocumentListCardProps {
  item: DocumentListItem
  onRemove: () => void
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  isRemoving?: boolean
}

export const DocumentListCard = forwardRef<
  HTMLDivElement,
  DocumentListCardProps
>(function DocumentListCard(
  { item, onRemove, isDragging, dragHandleProps, isRemoving },
  ref
) {
  const theme = getDocumentTheme(item.document.contentType)
  const ThemeIcon = theme.icon
  const documentUrl = getDocumentUrl(
    item.document.contentType,
    item.document.slug,
    true
  )
  const defaultStatus = {
    label: 'Ej påbörjad',
    className:
      'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400',
  }
  const statusConfig = STATUS_CONFIG[item.status] ?? defaultStatus
  const priorityConfig = item.priority === 'HIGH' ? PRIORITY_CONFIG.HIGH : null

  return (
    <div
      ref={ref}
      data-testid="document-card"
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card p-4',
        'h-[130px]', // Fixed height for consistency
        'transition-all duration-200',
        'hover:shadow-md hover:shadow-black/5',
        isDragging && 'shadow-lg ring-2 ring-primary/20',
        isRemoving && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Drag handle - subtle, top right */}
      <button
        {...dragHandleProps}
        className={cn(
          'absolute top-2 right-2 z-10 touch-none cursor-grab active:cursor-grabbing',
          'p-1.5 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        aria-label="Dra för att ändra ordning"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Title - fixed height for 2 lines with end fade effect */}
      <div className="relative h-10 overflow-hidden">
        <Link href={documentUrl} className="block group/link pr-8">
          <h3 className="text-sm font-semibold leading-5 text-foreground group-hover/link:text-foreground/80 line-clamp-2">
            {item.document.title}
          </h3>
        </Link>
        {/* Fade effect - positioned at end of second line only */}
        <div
          className="absolute bottom-0 right-8 h-5 w-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, transparent, hsl(var(--card)) 70%)',
          }}
        />
      </div>

      {/* Meta row: Badge + Document number - fixed height */}
      <div className="mt-2 flex items-center gap-1.5 text-xs h-5">
        <Badge
          className={cn('gap-1 text-xs py-0 px-1.5 shrink-0', theme.badge)}
        >
          <ThemeIcon className="h-3 w-3" />
          {theme.label}
        </Badge>
        <span className="text-muted-foreground truncate">
          {item.document.documentNumber}
        </span>
      </div>

      {/* Spacer to push status to bottom */}
      <div className="flex-1 min-h-2" />

      {/* Status row - fixed at bottom */}
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn('text-xs py-0', statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
        {priorityConfig && (
          <Badge
            variant="outline"
            className={cn('text-xs py-0', priorityConfig.className)}
          >
            {priorityConfig.label}
          </Badge>
        )}
      </div>

      {/* Remove button - bottom right, aligned with drag handle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'absolute bottom-3 right-2 h-6 w-6',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10'
              )}
              onClick={onRemove}
              disabled={isRemoving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ta bort från listan</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
})

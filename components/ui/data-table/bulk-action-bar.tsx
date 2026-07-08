'use client'

/**
 * Generic bulk-action bar shell (Story 28.6) — extracted from the laglistor
 * implementation. The shell owns the selection count, clear button and
 * loading state; the domain actions (Selects, buttons) are children.
 * Renderer-agnostic: works above the table and the card list alike.
 */

import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DataTableBulkBarProps {
  selectedCount: number
  onClearSelection: () => void
  /** Dims the actions and shows a spinner while a bulk mutation runs. */
  isLoading?: boolean
  /** Domain actions (stays-open Selects, buttons, …). */
  children?: React.ReactNode
  className?: string
}

export function DataTableBulkBar({
  selectedCount,
  onClearSelection,
  isLoading = false,
  children,
  className,
}: DataTableBulkBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 p-3',
        'animate-in slide-in-from-top-2 duration-200',
        className
      )}
      role="toolbar"
      aria-label="Massåtgärder"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'vald' : 'valda'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Rensa markering</span>
        </Button>
      </div>

      {children && <div className="h-4 w-px bg-border" />}
      {children}

      {isLoading && (
        <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

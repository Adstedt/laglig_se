'use client'

/**
 * Load-more footer strategies. `button` covers both offset-append and
 * cursor-append (the strategy object doesn't care where the next page
 * comes from); `pagination` is the admin numbered prev/next;
 * `infinite` is wired from the virtualizer's end-reach by the views.
 */
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LoadMoreStrategy } from '../types'

export function LoadMoreFooter({
  strategy,
}: {
  strategy: LoadMoreStrategy | undefined
}) {
  if (!strategy || strategy.kind === 'none' || strategy.kind === 'infinite') {
    return null
  }

  if (strategy.kind === 'button') {
    if (!strategy.hasMore) return null
    return (
      <div className="flex flex-col items-center gap-1 pt-4">
        <Button
          variant="outline"
          onClick={strategy.onLoadMore}
          disabled={strategy.isLoading}
        >
          {strategy.isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Laddar…
            </>
          ) : (
            (strategy.label ?? 'Visa fler')
          )}
        </Button>
        {strategy.shownCount !== undefined &&
          strategy.totalCount !== undefined && (
            <span className="text-xs text-muted-foreground">
              Visar {strategy.shownCount} av {strategy.totalCount}
            </span>
          )}
      </div>
    )
  }

  // pagination
  const { page, pageCount, onPageChange } = strategy
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      <span className="text-xs text-muted-foreground">
        Sida {page} av {Math.max(pageCount, 1)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Föregående sida"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Nästa sida"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

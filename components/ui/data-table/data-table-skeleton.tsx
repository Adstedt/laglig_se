'use client'

import { cn } from '@/lib/utils'

export function DataTableSkeleton({
  variant = 'table',
  rows = 8,
  className,
}: {
  variant?: 'table' | 'card'
  rows?: number
  className?: string
}) {
  if (variant === 'card') {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-3">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="mt-2 flex gap-1.5">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-2/5 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('rounded-md border', className)} aria-busy="true">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
        >
          <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

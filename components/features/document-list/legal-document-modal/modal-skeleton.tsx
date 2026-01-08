'use client'

/**
 * Story 6.3: Modal Skeleton
 * Loading state for the legal document modal
 */

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function ModalSkeleton() {
  return (
    <div className="flex flex-col h-full max-h-[90vh] bg-background border shadow-lg rounded-lg overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Two-panel layout skeleton */}
      <div
        className={cn(
          'grid flex-1 min-h-0',
          'grid-cols-1 md:grid-cols-[3fr_2fr]'
        )}
      >
        {/* Left panel */}
        <div className="p-6 space-y-6 overflow-hidden">
          {/* Law header */}
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>

          {/* Lagtext section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-8 w-24 mx-auto" />
          </div>

          {/* Business context */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>

          {/* Activity tabs */}
          <div className="space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>

        {/* Right panel */}
        <div className="border-l bg-muted/30 p-6 space-y-6 max-md:border-t max-md:border-l-0">
          {/* Details box */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick links box */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* Tasks summary box */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>

          {/* Evidence summary box */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-12" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

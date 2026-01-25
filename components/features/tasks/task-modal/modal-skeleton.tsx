'use client'

/**
 * Story 6.6: Task Modal Skeleton
 * Loading state skeleton for task modal
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ModalSkeleton() {
  return (
    <div className="bg-background border rounded-lg shadow-lg overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] min-h-[60vh]">
        {/* Left panel */}
        <div className="p-6 space-y-6 border-r">
          {/* Title skeleton */}
          <Skeleton className="h-8 w-3/4" />

          {/* Badges skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Description skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>

          {/* Activity tabs skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        {/* Right panel */}
        <div className="p-6 space-y-4 bg-muted/30">
          {/* Details box skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick links skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>

          {/* Linked laws skeleton */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

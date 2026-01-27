/**
 * Story 4.11: Document List Skeletons
 * Loading states for document list components
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function DocumentListPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header with switcher and actions */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>

      {/* Card grid */}
      <DocumentListGridSkeleton />
    </div>
  )
}

export function DocumentListGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function DocumentCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DocumentListSwitcherSkeleton() {
  return <Skeleton className="h-10 w-48" />
}

export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 rounded-lg border"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

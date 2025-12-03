import { Skeleton } from '@/components/ui/skeleton'

export default function CourtCaseLoading() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumbs skeleton */}
      <Skeleton className="mb-6 h-4 w-64" />

      {/* Title skeleton */}
      <Skeleton className="mb-4 h-10 w-3/4" />

      {/* Badges skeleton */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Date skeleton */}
      <Skeleton className="mb-8 h-4 w-48" />

      {/* Case details card skeleton */}
      <div className="mb-8 rounded-lg border p-6">
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* Summary card skeleton */}
      <div className="mb-8 rounded-lg border p-6">
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </main>
  )
}

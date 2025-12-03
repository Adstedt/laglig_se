import { Skeleton } from '@/components/ui/skeleton'

export default function LawPageLoading() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumbs skeleton */}
      <Skeleton className="mb-6 h-4 w-48" />

      {/* Title skeleton */}
      <Skeleton className="mb-4 h-10 w-3/4" />

      {/* Metadata badges skeleton */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Date info skeleton */}
      <div className="mb-6 flex gap-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-40" />
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
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </main>
  )
}

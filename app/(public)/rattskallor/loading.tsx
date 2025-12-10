import { Skeleton } from '@/components/ui/skeleton'

export default function RattskallolLoading() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-4 h-5 w-96" />
        <Skeleton className="h-14 w-full" />
      </div>

      <div className="flex gap-8">
        {/* Sidebar skeleton (desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-3 h-5 w-24" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Results skeleton */}
        <main className="min-w-0 flex-1">
          {/* Results header */}
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>

          {/* Result cards */}
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5">
                <Skeleton className="mb-3 h-6 w-3/4" />
                <div className="mb-3 flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>

          {/* Pagination skeleton */}
          <div className="mt-8 flex justify-center">
            <Skeleton className="h-9 w-64" />
          </div>
        </main>
      </div>
    </div>
  )
}

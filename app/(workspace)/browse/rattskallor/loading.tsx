import { Skeleton } from '@/components/ui/skeleton'

export default function WorkspaceRattskallolLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      {/* Search Bar */}
      <Skeleton className="h-10 w-full max-w-md" />

      <div className="flex gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <main className="min-w-0 flex-1">
          <div className="space-y-4">
            <div className="mb-6 flex items-start justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-9 w-[160px]" />
            </div>
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
            <div className="mt-8 flex justify-center">
              <Skeleton className="h-9 w-64" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

export default function LawsListingLoading() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumbs skeleton */}
      <Skeleton className="mb-6 h-4 w-32" />

      {/* Title skeleton */}
      <Skeleton className="mb-2 h-10 w-48" />
      <Skeleton className="mb-8 h-5 w-64" />

      {/* Section title skeleton */}
      <Skeleton className="mb-4 h-6 w-36" />

      {/* Cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6">
            <div className="mb-2 flex items-start justify-between gap-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
    </main>
  )
}

/**
 * Story 12.8: Loading skeleton for template catalog page
 */

export default function TemplateCatalogLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-1">
        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
      </div>

      {/* Page header skeleton */}
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="mt-2 h-5 w-96 bg-muted animate-pulse rounded" />
      </div>

      {/* Filter badges skeleton */}
      <div className="flex gap-2">
        <div className="h-6 w-12 bg-muted animate-pulse rounded-full" />
        <div className="h-6 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex justify-between">
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="h-4 w-40 bg-muted animate-pulse rounded-full" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
            <div className="flex gap-4">
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

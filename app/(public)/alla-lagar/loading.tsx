export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-2">
        <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>

      {/* List skeleton */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="py-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 flex gap-4">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

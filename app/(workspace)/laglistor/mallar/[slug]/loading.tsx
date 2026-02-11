/**
 * Story 12.9: Loading skeleton for template detail page
 */

export default function TemplateDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton: title + description + badges + stats bar */}
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-5 w-full max-w-lg bg-muted animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-24 bg-muted animate-pulse rounded-full" />
          <div className="h-6 w-32 bg-muted animate-pulse rounded-full" />
          <div className="h-6 w-28 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-12 w-full max-w-md bg-muted animate-pulse rounded-lg" />
      </div>

      {/* Accordion section skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}

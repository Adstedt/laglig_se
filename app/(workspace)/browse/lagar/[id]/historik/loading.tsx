import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function WorkspaceHistoryLoading() {
  return (
    <div className="space-y-6">
      {/* Hero Header Skeleton */}
      <div className="rounded-xl bg-card p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <Skeleton className="hidden sm:block h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t">
          <Skeleton className="h-9 w-40" />
        </div>
      </div>

      {/* Info banner Skeleton */}
      <Skeleton className="h-24 w-full rounded-lg" />

      {/* Timeline Card Skeleton */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Timeline items */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Version dates Skeleton */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

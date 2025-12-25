import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function WorkspaceCourtCaseLoading() {
  return (
    <div className="space-y-6">
      {/* Hero Header Skeleton */}
      <div className="rounded-xl bg-card p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <Skeleton className="hidden sm:block h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t flex gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>

      {/* Summary Skeleton */}
      <Card className="border-l-4 border-l-primary/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>

      {/* Content Skeleton */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <Skeleton className="h-6 w-20" />
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-9/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </CardContent>
      </Card>
    </div>
  )
}

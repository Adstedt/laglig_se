/**
 * Story 6.4: Task Page Loading State
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Tab Navigation */}
      <Skeleton className="h-10 w-full max-w-md" />

      {/* Summary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    </div>
  )
}

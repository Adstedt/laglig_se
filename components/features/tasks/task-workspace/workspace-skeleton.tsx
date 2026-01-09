/**
 * Story 6.4: Task Workspace Loading Skeletons
 * Tab-specific loading states
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import type { TaskTab } from './tab-navigation'

interface WorkspaceSkeletonProps {
  tab: TaskTab
}

export function WorkspaceSkeleton({ tab }: WorkspaceSkeletonProps) {
  switch (tab) {
    case 'sammanfattning':
      return <SummaryTabSkeleton />
    case 'aktiva':
      return <KanbanTabSkeleton />
    case 'lista':
    case 'alla':
      return <ListTabSkeleton />
    case 'kalender':
      return <CalendarTabSkeleton />
    default:
      return <ListTabSkeleton />
  }
}

function SummaryTabSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Stats cards */}
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}

      {/* Charts */}
      <Card className="p-6 md:col-span-2">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-48 w-full" />
      </Card>
      <Card className="p-6 md:col-span-2">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-48 w-full" />
      </Card>

      {/* Activity feed */}
      <Card className="p-6 lg:col-span-4">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function KanbanTabSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="w-80 flex-shrink-0">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-8" />
            </div>
            <div className="space-y-3">
              {[...Array(3 - i)].map((_, j) => (
                <Card key={j} className="p-3">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3 mb-3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}

function ListTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b bg-muted/50 p-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b p-3 last:border-0">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-md p-4">
        {/* Week header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
        {/* Calendar days */}
        {[...Array(5)].map((_, week) => (
          <div key={week} className="grid grid-cols-7 gap-1 mb-1">
            {[...Array(7)].map((_, day) => (
              <div key={day} className="aspect-square p-2">
                <Skeleton className="h-6 w-6 mb-1" />
                {Math.random() > 0.7 && <Skeleton className="h-4 w-full" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

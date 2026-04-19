'use client'

/**
 * Story 6.10: Global Activity Log Page
 * Workspace-wide activity feed with filters and pagination
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getWorkspaceActivity,
  type WorkspaceActivityEntry,
} from '@/app/actions/workspace-activity'
import { ActivityLogTable } from '@/components/features/activity/activity-log-table'
import { ActivityFilters } from '@/components/features/activity/activity-filters'
import {
  type ActivityFilters as FilterState,
  parseActivityFiltersFromUrl,
  serializeActivityFiltersToUrl,
} from '@/lib/utils/activity-filter-params'

export default function WorkspaceActivityPage() {
  const searchParams = useSearchParams()
  const [activities, setActivities] = useState<WorkspaceActivityEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() =>
    parseActivityFiltersFromUrl(new URLSearchParams(searchParams.toString()))
  )

  const fetchActivities = useCallback(
    async (currentFilters: FilterState, cursor?: string) => {
      const result = await getWorkspaceActivity(
        {
          userId: currentFilters.userFilter,
          entityType: currentFilters.entityTypeFilter.length
            ? currentFilters.entityTypeFilter
            : undefined,
          action: currentFilters.actionFilter.length
            ? currentFilters.actionFilter
            : undefined,
          category: currentFilters.categoryFilter.length
            ? currentFilters.categoryFilter
            : undefined,
          startDate: currentFilters.startDate,
          endDate: currentFilters.endDate,
        },
        cursor
      )

      if (result.success && result.data) {
        return result.data
      }
      return null
    },
    []
  )

  // Initial load and filter changes
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetchActivities(filters).then((data) => {
      if (cancelled) return
      if (data) {
        setActivities(data.activities)
        setNextCursor(data.nextCursor ?? null)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [filters, fetchActivities])

  const handleLoadMore = async () => {
    if (!nextCursor) return
    setIsLoadingMore(true)

    const data = await fetchActivities(filters, nextCursor)
    if (data) {
      setActivities((prev) => [...prev, ...data.activities])
      setNextCursor(data.nextCursor ?? null)
    }

    setIsLoadingMore(false)
  }

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  const handleExportCsv = () => {
    const params = serializeActivityFiltersToUrl(filters)
    window.open(
      `/api/workspace/activity-log/export?${params.toString()}`,
      '_blank'
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aktivitetslogg</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alla ändringar och aktiviteter i din workspace.
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-2" />
          Exportera CSV
        </Button>
      </div>

      <ActivityFilters onFiltersChange={handleFiltersChange} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <ActivityLogTable activities={activities} />

          {nextCursor && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Laddar...
                  </>
                ) : (
                  'Ladda fler'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

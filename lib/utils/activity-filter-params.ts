/**
 * Story 6.10: Activity Filter URL Params
 * Utility for serializing/deserializing activity log filters to URL search params.
 * Activity-log revamp: added `categoryFilter` for the category-grouped filter UI.
 */

import type { ActivityCategory } from '@/lib/activity/types'
import { ACTIVITY_CATEGORIES } from '@/lib/activity/categories'

export interface ActivityFilters {
  userFilter?: string | undefined
  actionFilter: string[]
  entityTypeFilter: string[]
  categoryFilter: ActivityCategory[]
  startDate?: string | undefined
  endDate?: string | undefined
}

function isCategory(value: string): value is ActivityCategory {
  return (ACTIVITY_CATEGORIES as string[]).includes(value)
}

export function parseActivityFiltersFromUrl(
  searchParams: URLSearchParams
): ActivityFilters {
  return {
    userFilter: searchParams.get('user') || undefined,
    actionFilter: searchParams.getAll('action'),
    entityTypeFilter: searchParams.getAll('entityType'),
    categoryFilter: searchParams.getAll('category').filter(isCategory),
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  }
}

export function serializeActivityFiltersToUrl(
  filters: ActivityFilters,
  existingParams?: URLSearchParams
): URLSearchParams {
  const params = existingParams
    ? new URLSearchParams(existingParams)
    : new URLSearchParams()

  // Clear existing filter params
  params.delete('user')
  params.delete('action')
  params.delete('entityType')
  params.delete('category')
  params.delete('startDate')
  params.delete('endDate')

  if (filters.userFilter) params.set('user', filters.userFilter)
  filters.actionFilter.forEach((a) => params.append('action', a))
  filters.entityTypeFilter.forEach((e) => params.append('entityType', e))
  filters.categoryFilter.forEach((c) => params.append('category', c))
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)

  return params
}

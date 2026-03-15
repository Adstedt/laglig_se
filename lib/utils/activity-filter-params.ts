/**
 * Story 6.10: Activity Filter URL Params
 * Utility for serializing/deserializing activity log filters to URL search params
 */

export interface ActivityFilters {
  userFilter?: string | undefined
  actionFilter: string[]
  entityTypeFilter: string[]
  startDate?: string | undefined
  endDate?: string | undefined
}

export function parseActivityFiltersFromUrl(
  searchParams: URLSearchParams
): ActivityFilters {
  return {
    userFilter: searchParams.get('user') || undefined,
    actionFilter: searchParams.getAll('action'),
    entityTypeFilter: searchParams.getAll('entityType'),
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
  params.delete('startDate')
  params.delete('endDate')

  if (filters.userFilter) params.set('user', filters.userFilter)
  filters.actionFilter.forEach((a) => params.append('action', a))
  filters.entityTypeFilter.forEach((e) => params.append('entityType', e))
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)

  return params
}

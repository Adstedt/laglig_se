/**
 * Story 6.19: Task Filter URL Parameter Utilities
 * Parse and serialize task filter state to/from URL search params
 */

import type { TaskFilterState } from '@/components/features/tasks/task-workspace/task-filters-toolbar'

/**
 * Parse task filters from URL search params
 */
export function parseTaskFiltersFromUrl(
  searchParams: URLSearchParams
): TaskFilterState & { searchQuery: string } {
  const qParam = searchParams.get('q')
  const statusParam = searchParams.get('status')
  const priorityParam = searchParams.get('priority')
  const assigneeParam = searchParams.get('assignee')

  return {
    searchQuery: qParam ?? '',
    statusFilter: statusParam ? statusParam.split(',') : [],
    priorityFilter: priorityParam ? priorityParam.split(',') : [],
    assigneeFilter: assigneeParam || null,
  }
}

/**
 * Serialize task filters to URL search params string.
 * Returns the params object for use with router.replace().
 */
export function serializeTaskFiltersToUrl(
  filters: TaskFilterState & { searchQuery: string },
  existingParams: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams(existingParams)

  if (filters.searchQuery) {
    params.set('q', filters.searchQuery)
  } else {
    params.delete('q')
  }

  if (filters.statusFilter.length > 0) {
    params.set('status', filters.statusFilter.join(','))
  } else {
    params.delete('status')
  }

  if (filters.priorityFilter.length > 0) {
    params.set('priority', filters.priorityFilter.join(','))
  } else {
    params.delete('priority')
  }

  if (filters.assigneeFilter) {
    params.set('assignee', filters.assigneeFilter)
  } else {
    params.delete('assignee')
  }

  return params
}

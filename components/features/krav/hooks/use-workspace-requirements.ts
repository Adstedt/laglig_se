'use client'

/**
 * Story 20.3: SWR hooks for the /krav page.
 *
 * - useWorkspaceRequirements: paged cursor-based read of kravpunkter for the
 *   active (filter, search, sort, cursor) tuple. Uses keepPreviousData so the
 *   table doesn't flash a skeleton while filters change.
 * - useWorkspaceRequirementCounts: the four chip-badge counts. Lightweight.
 *
 * Fetchers throw on { success: false } so SWR's error state kicks in and the
 * page-level error boundary (Task 4, AC 10) can render the "Försök igen" UI.
 */

import useSWR from 'swr'
import {
  getWorkspaceRequirements,
  getWorkspaceRequirementCounts,
  type GetWorkspaceRequirementsInput,
  type WorkspaceRequirementRow,
} from '@/app/actions/workspace-requirements'

export const WORKSPACE_REQUIREMENTS_KEY = 'workspace-requirements'
export const WORKSPACE_REQUIREMENT_COUNTS_KEY = 'workspace-requirement-counts'

export interface UseWorkspaceRequirementsResult {
  items: WorkspaceRequirementRow[]
  nextCursor: string | null
}

export function useWorkspaceRequirements(input: GetWorkspaceRequirementsInput) {
  // Include every input in the key so different filter/sort/cursor tuples are
  // distinct cache entries. `sort` is serialised because SWR compares keys by
  // shallow reference for tuple elements.
  const key: [
    string,
    GetWorkspaceRequirementsInput['filter'],
    string,
    string,
    string,
  ] = [
    WORKSPACE_REQUIREMENTS_KEY,
    input.filter,
    input.search ?? '',
    `${input.sort?.field ?? 'updated_at'}:${input.sort?.direction ?? 'desc'}`,
    input.cursor ?? '',
  ]

  return useSWR<UseWorkspaceRequirementsResult>(
    key,
    async () => {
      const result = await getWorkspaceRequirements(input)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kravpunkter')
      }
      return result.data
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )
}

export function useWorkspaceRequirementCounts() {
  return useSWR(
    [WORKSPACE_REQUIREMENT_COUNTS_KEY],
    async () => {
      const result = await getWorkspaceRequirementCounts()
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kravräkningar')
      }
      return result.data
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )
}

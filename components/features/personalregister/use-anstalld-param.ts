'use client'

/**
 * Story 7.2: `?anstalld=` URL param hook (Personalkort modal target — the
 * modal itself is Story 7.3).
 *
 * Mirrors DocumentListPageContent's `?document=` open/close/sync pattern:
 *  - open  = `params.set('anstalld', id)` + `window.history.pushState`
 *  - close = `params.delete('anstalld')` + `window.history.pushState`
 *  - URL → state sync effect on `useSearchParams()` (browser back/forward);
 *    the sync NEVER writes the URL back.
 *
 * `'ny'` is the reserved create-mode sentinel consumed by Story 7.3 — it is
 * stored verbatim and never used for lookups (no lookups happen here at all).
 *
 * Extracted from `personalregister-content.tsx` per QA TEST-001 so the
 * open/close/sync behavior is directly testable; `selectedEmployeeId` +
 * `closeEmployee` are the contract Story 7.3's modal mounts on.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export const ANSTALLD_PARAM = 'anstalld'

/** Reserved create-mode sentinel (Story 7.3) — never an employee id. */
export const NEW_EMPLOYEE_SENTINEL = 'ny'

export function useAnstalldParam() {
  const searchParams = useSearchParams()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  )

  const openEmployee = useCallback((employeeId: string) => {
    // Update local state immediately for instant feedback
    setSelectedEmployeeId(employeeId)
    // Update URL instantly using the History API (faster than router.push)
    const params = new URLSearchParams(window.location.search)
    params.set(ANSTALLD_PARAM, employeeId)
    window.history.pushState(null, '', `?${params.toString()}`)
  }, [])

  const closeEmployee = useCallback(() => {
    setSelectedEmployeeId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete(ANSTALLD_PARAM)
    const query = params.toString()
    window.history.pushState(
      null,
      '',
      query ? `?${query}` : window.location.pathname
    )
  }, [])

  // URL → state sync (browser back/forward). `'ny'` is stored verbatim and
  // NEVER used for lookups.
  const employeeIdFromUrl = searchParams.get(ANSTALLD_PARAM)
  useEffect(() => {
    if (employeeIdFromUrl !== selectedEmployeeId) {
      setSelectedEmployeeId(employeeIdFromUrl)
    }
  }, [employeeIdFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return { selectedEmployeeId, openEmployee, closeEmployee }
}

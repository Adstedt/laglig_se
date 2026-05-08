'use client'

/**
 * Story 8.1 Task 1: Law List Tabs
 * Conditional content shell that swaps between the Laglistor view (children)
 * and the Ändringar view (`<ChangesTab>`) based on `?tab=changes`.
 *
 * The visible tab strip itself lives in `<LawListTabsStrip>` and is mounted
 * inline by each surface — inside the toolbar on the lists tab, at the top
 * of the changes tab — so the tabs share a row with the toolbar instead of
 * sitting above it. URL search params remain the source of truth.
 */

import { type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChangesTab } from './changes-tab'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

interface LawListTabsProps {
  children: ReactNode
  initialChangeCount?: number
  initialChanges?: UnacknowledgedChange[]
}

export function LawListTabs({
  children,
  initialChangeCount = 0,
  initialChanges = [],
}: LawListTabsProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'changes' ? 'changes' : 'lists'

  return activeTab === 'lists' ? (
    <>{children}</>
  ) : (
    <ChangesTab
      initialChanges={initialChanges}
      changeCount={initialChangeCount}
    />
  )
}

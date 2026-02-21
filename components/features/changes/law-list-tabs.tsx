'use client'

/**
 * Story 8.1 Task 1: Law List Tabs
 * Tab wrapper rendering "Mina listor" (existing content) and "Ändringar" tab.
 * Uses the same toggle pattern as the Mallar page for design consistency.
 * Active tab is stored in URL search params (?tab=changes) for deep linking.
 *
 * Perf: changeCount and initialChanges are fetched server-side in
 * laglistor/page.tsx and passed as props — no client-side waterfall.
 */

import { type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
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
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = searchParams.get('tab') === 'changes' ? 'changes' : 'lists'

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'changes') {
      params.set('tab', 'changes')
      params.delete('list')
      params.delete('group')
      params.delete('document')
    } else {
      params.delete('tab')
      params.delete('priority')
    }
    router.push(`/laglistor?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      {/* Tab toggle — matches Mallar page design pattern */}
      <div className="inline-flex min-w-[232px] rounded-lg border bg-muted/30 p-0.5">
        <button
          onClick={() => handleTabChange('lists')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'lists'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Mina listor
        </button>
        <button
          onClick={() => handleTabChange('changes')}
          className={cn(
            'relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'changes'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Ändringar
          {initialChangeCount > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
              {initialChangeCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'lists' ? (
        children
      ) : (
        <ChangesTab initialChanges={initialChanges} />
      )}
    </div>
  )
}

'use client'

/**
 * Story 8.1 Task 1: Law List Tabs
 * Tab wrapper rendering "Laglistor" (existing content) and "Ändringar" tab.
 *
 * Story 22.3 follow-up — Migrated from hand-rolled `<button>` toggles
 * inside a `rounded-lg border bg-muted/30` enclosing pill to the shared
 * `WorkspaceViewTabs` primitive. Same loose chrome as /tasks +
 * /workspace/styrdokument.
 *
 * Active tab is stored in URL search params (?tab=changes) for deep linking.
 */

import { type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, History } from 'lucide-react'
import {
  WorkspaceViewTabs,
  WorkspaceViewTabsList,
  WorkspaceViewTabsTrigger,
} from '@/components/ui/workspace-view-tabs'
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
      <WorkspaceViewTabs value={activeTab} onValueChange={handleTabChange}>
        <WorkspaceViewTabsList>
          <WorkspaceViewTabsTrigger value="lists">
            <BookOpen className="h-4 w-4" />
            Laglistor
          </WorkspaceViewTabsTrigger>
          <WorkspaceViewTabsTrigger value="changes" className="relative">
            <History className="h-4 w-4" />
            Ändringar
            {initialChangeCount > 0 && (
              <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                {initialChangeCount}
              </span>
            )}
          </WorkspaceViewTabsTrigger>
        </WorkspaceViewTabsList>
      </WorkspaceViewTabs>

      {/* Tab content */}
      {activeTab === 'lists' ? (
        children
      ) : (
        <ChangesTab initialChanges={initialChanges} />
      )}
    </div>
  )
}

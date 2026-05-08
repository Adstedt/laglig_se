'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, History } from 'lucide-react'
import {
  WorkspaceViewTabs,
  WorkspaceViewTabsList,
  WorkspaceViewTabsTrigger,
} from '@/components/ui/workspace-view-tabs'

interface LawListTabsStripProps {
  changeCount?: number
}

export function LawListTabsStrip({ changeCount = 0 }: LawListTabsStripProps) {
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
    <WorkspaceViewTabs value={activeTab} onValueChange={handleTabChange}>
      <WorkspaceViewTabsList>
        <WorkspaceViewTabsTrigger value="lists">
          <BookOpen className="h-4 w-4" />
          Laglistor
        </WorkspaceViewTabsTrigger>
        <WorkspaceViewTabsTrigger value="changes" className="relative">
          <History className="h-4 w-4" />
          Ändringar
          {changeCount > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
              {changeCount}
            </span>
          )}
        </WorkspaceViewTabsTrigger>
      </WorkspaceViewTabsList>
    </WorkspaceViewTabs>
  )
}

'use client'

/**
 * Story 14.11: HemPage client wrapper
 * Full-height container for the Hem chat interface.
 * Negates parent padding to achieve edge-to-edge layout.
 *
 * Story 14.10: Manages transition between home state and change assessment view.
 */

import { useState, useCallback } from 'react'
import { HemChat } from '@/components/features/dashboard/hem-chat'
import { ChangeAssessmentView } from '@/components/features/dashboard/change-assessment-view'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

interface HemPageProps {
  dashboardData: DashboardCardData | null
  userName?: string | undefined
}

export function HemPage({ dashboardData, userName }: HemPageProps) {
  const [activeChange, setActiveChange] = useState<UnacknowledgedChange | null>(
    null
  )

  const handleSelectChange = useCallback((change: UnacknowledgedChange) => {
    setActiveChange(change)
  }, [])

  const handleBack = useCallback(() => {
    setActiveChange(null)
  }, [])

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-60px)]">
      {activeChange ? (
        <ChangeAssessmentView change={activeChange} onBack={handleBack} />
      ) : (
        <HemChat
          mode="full"
          dashboardData={dashboardData}
          userName={userName}
          onSelectChange={handleSelectChange}
        />
      )}
    </div>
  )
}

'use client'

/**
 * Story 14.11: HemPage client wrapper
 * Full-height container for the Hem chat interface.
 * Negates parent padding to achieve edge-to-edge layout.
 *
 * Story 14.10: Manages transition between home state and change assessment view.
 */

import { useState, useCallback, useEffect } from 'react'
import { HemChat } from '@/components/features/dashboard/hem-chat'
import { ChangeAssessmentView } from '@/components/features/dashboard/change-assessment-view'
import { LawListGenerationProgress } from '@/components/features/dashboard/law-list-generation-progress'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'

interface HemPageProps {
  dashboardData: DashboardCardData | null
  userName?: string | undefined
  /** Pre-fetched change for deep-link from email notifications */
  initialChange?: UnacknowledgedChange | null
  /** Story 8.23: Auto-open amendments picker from deep-link */
  initialView?: 'amendments' | undefined
  /** Story 16.4: Law list generation status */
  generationStatus?: string | null
}

export function HemPage({
  dashboardData,
  userName,
  initialChange,
  initialView,
  generationStatus,
}: HemPageProps) {
  const [activeChange, setActiveChange] = useState<UnacknowledgedChange | null>(
    initialChange ?? null
  )

  // Clean the URL after consuming the deep-link param
  useEffect(() => {
    if (initialChange || initialView) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [initialChange, initialView])

  // Story 8.23: Clear assessment view when navigating back via ?view=amendments
  // (e.g., clicking a notification while inside an assessment)
  useEffect(() => {
    if (initialView === 'amendments') {
      setActiveChange(null)
    }
  }, [initialView])

  const handleSelectChange = useCallback((change: UnacknowledgedChange) => {
    setActiveChange(change)
  }, [])

  const handleBack = useCallback(() => {
    setActiveChange(null)
  }, [])

  const showGenerationProgress =
    generationStatus === 'pending' ||
    generationStatus === 'in_progress' ||
    generationStatus === 'completed' ||
    generationStatus === 'failed'

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-60px)]">
      {showGenerationProgress && (
        <div className="px-4 md:px-6 pt-4 md:pt-6">
          <LawListGenerationProgress initialStatus={generationStatus ?? null} />
        </div>
      )}
      {activeChange ? (
        <ChangeAssessmentView change={activeChange} onBack={handleBack} />
      ) : (
        <HemChat
          mode="full"
          dashboardData={dashboardData}
          userName={userName}
          onSelectChange={handleSelectChange}
          initialView={initialView}
        />
      )}
    </div>
  )
}

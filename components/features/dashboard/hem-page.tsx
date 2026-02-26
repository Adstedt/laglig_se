'use client'

/**
 * Story 14.11: HemPage client wrapper
 * Full-height container for the Hem chat interface.
 * Negates parent padding to achieve edge-to-edge layout.
 */

import { HemChat } from '@/components/features/dashboard/hem-chat'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'

interface HemPageProps {
  dashboardData: DashboardCardData | null
  userName?: string | undefined
}

export function HemPage({ dashboardData, userName }: HemPageProps) {
  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-60px)]">
      <HemChat mode="full" dashboardData={dashboardData} userName={userName} />
    </div>
  )
}

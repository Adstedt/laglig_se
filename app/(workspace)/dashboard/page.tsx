/**
 * Story 14.11: Hem — Chat-first dashboard page
 * Server component that fetches dashboard data and renders the HemChat client component.
 * Route remains /dashboard (no URL breaking change).
 *
 * Supports ?changeId= deep-link from email notifications to auto-enter assessment view.
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { getCurrentUser } from '@/lib/auth/session'
import { getDashboardData } from '@/lib/db/queries/dashboard'
import {
  getUnacknowledgedChangeCount,
  getUnacknowledgedChangeById,
} from '@/app/actions/change-events'
import { prisma } from '@/lib/prisma'
import { HemPage } from '@/components/features/dashboard/hem-page'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'
import {
  getOnboardingState,
  type OnboardingState,
} from '@/lib/onboarding/get-onboarding-state'
import { isFirstRunModalEnabled } from '@/lib/onboarding/first-run-modal-flag'
import {
  getPublishedTemplates,
  type PublishedTemplate,
} from '@/lib/db/queries/template-catalog'

// Story 25.0 (Epic 25): emergency-disable flag for the first-run modal (AC 30).
// Read once at module load on the server (hem-page.tsx is a client component
// and cannot read non-NEXT_PUBLIC_ env vars — so the env read lives here and
// the value is passed down as a prop; the mount guard stays in hem-page.tsx).
// The predicate is extracted to a tested pure helper (QA TEST-001).
const FIRST_RUN_MODAL_V0_ENABLED = isFirstRunModalEnabled(
  process.env.FIRST_RUN_MODAL_V0
)

interface DashboardPageProps {
  searchParams: Promise<{ changeId?: string; view?: string }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [context, user, params] = await Promise.all([
    getWorkspaceContext(),
    getCurrentUser(),
    searchParams,
  ])

  let dashboardData: DashboardCardData | null = null
  try {
    const [data, changeCountResult] = await Promise.all([
      getDashboardData(context.workspaceId, context.userId),
      getUnacknowledgedChangeCount(),
    ])
    dashboardData = {
      complianceStats: data.complianceStats,
      taskCounts: data.taskCounts,
      ...(changeCountResult.success && changeCountResult.data !== undefined
        ? { pendingAmendments: changeCountResult.data }
        : {}),
    }
  } catch {
    // Data fetch failed — context cards will show "–" values
  }

  // Deep-link: fetch initial change if changeId is provided
  let initialChange = null
  if (params.changeId) {
    try {
      const result = await getUnacknowledgedChangeById(params.changeId)
      if (result.success && result.data) {
        initialChange = result.data
      }
    } catch {
      // Invalid or expired changeId — fall through to normal dashboard
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? undefined

  // Story 16.4: Check law list generation status
  // Story 25.0: derive first-run onboarding state in parallel (one indexed
  // Workspace lookup — see AC 26). getOnboardingState has its own internal
  // try/catch returning a safe default, so this never throws.
  let generationStatus: string | null = null
  let onboardingState: OnboardingState = {
    firstRunOpen: false,
    fabVisible: false,
    fabState: 'idle',
  }
  try {
    const [ws, derivedOnboardingState] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: { law_list_generation_status: true },
      }),
      getOnboardingState(context.workspaceId),
    ])
    generationStatus = ws?.law_list_generation_status ?? null
    onboardingState = derivedOnboardingState
  } catch {
    // Non-critical — progress card / first-run modal simply won't show
  }

  // Story 25.1 (Epic 25): server-prefetch published templates for the modal's
  // inline template-pick sub-step ONLY when the modal will actually render —
  // saves the DB read on every dashboard hit for non-first-run users.
  let firstRunTemplates: PublishedTemplate[] | undefined
  if (FIRST_RUN_MODAL_V0_ENABLED && onboardingState.firstRunOpen) {
    try {
      firstRunTemplates = await getPublishedTemplates()
    } catch {
      // Non-critical — picker shows the empty-state fallback if prefetch fails
      firstRunTemplates = []
    }
  }

  return (
    <HemPage
      dashboardData={dashboardData}
      userName={firstName}
      initialChange={initialChange}
      initialView={params.view === 'amendments' ? 'amendments' : undefined}
      generationStatus={generationStatus}
      onboardingState={onboardingState}
      workspaceId={context.workspaceId}
      firstRunModalEnabled={FIRST_RUN_MODAL_V0_ENABLED}
      firstRunTemplates={firstRunTemplates}
    />
  )
}

/**
 * Story 25.6 (Epic 25, B.6): tests for <HemPage>'s FAB-mount + URL-deep-link
 * integration. Earlier B.0-B.5 behaviour (first-run modal mount, banner
 * conditional, change-assessment view) is covered indirectly by the
 * component being mounted in higher-level integration tests — this file
 * focuses on the B.6 conditional-mount logic that didn't have direct unit
 * coverage before.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()
const mockSearchParamsGet = vi.fn<(_key: string) => string | null>()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}))

vi.mock('@/components/features/dashboard/hem-chat', () => ({
  HemChat: () => <div data-testid="hem-chat-stub" />,
}))
vi.mock('@/components/features/dashboard/change-assessment-view', () => ({
  ChangeAssessmentView: () => <div data-testid="change-assessment-stub" />,
}))
vi.mock('@/components/features/dashboard/law-list-generation-progress', () => ({
  LawListGenerationProgress: () => (
    <div data-testid="law-list-generation-progress-stub" />
  ),
}))
vi.mock('@/components/features/onboarding-modal/first-run-modal', () => ({
  FirstRunModal: (props: {
    initialStep?: string
    initialTutorialTab?: string
    openTrigger?: string
  }) => (
    <div
      data-testid="first-run-modal-stub"
      data-initial-step={props.initialStep ?? 'path-choice'}
      data-initial-tab={props.initialTutorialTab ?? ''}
      data-open-trigger={props.openTrigger ?? 'first_run'}
    />
  ),
}))
vi.mock('@/components/features/onboarding-modal/onboarding-fab', () => ({
  OnboardingFab: (props: { fabState: string; celebrate?: boolean }) => (
    <div
      data-testid="onboarding-fab-stub"
      data-fab-state={props.fabState}
      data-celebrate={String(!!props.celebrate)}
    />
  ),
}))

const mockHasSeenDoneGenerate = vi.fn<(_workspaceId: string) => boolean>()
vi.mock('@/lib/onboarding/done-generate-shown', () => ({
  hasSeenDoneGenerate: (workspaceId: string) =>
    mockHasSeenDoneGenerate(workspaceId),
  markDoneGenerateShown: vi.fn(),
}))

// Story 25.6 v1.1: SWR is used for the background generation-status poll
// that triggers router.refresh() on completion. Mock to return controllable
// status values per test.
const mockUseSWR = vi.fn<() => { data?: { status?: string } | undefined }>()
vi.mock('swr', () => ({
  default: () => mockUseSWR(),
}))

import { HemPage } from '@/components/features/dashboard/hem-page'
import type { OnboardingState } from '@/lib/onboarding/get-onboarding-state'

const baseProps = {
  dashboardData: null,
  firstRunModalEnabled: true,
  workspaceId: 'ws_1',
}

function renderHemPage(
  onboardingState: OnboardingState,
  generationStatus: string | null = null
) {
  return render(
    <HemPage
      {...baseProps}
      onboardingState={onboardingState}
      generationStatus={generationStatus}
    />
  )
}

describe('<HemPage> — B.6 FAB + URL deep-link mount logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamsGet.mockReturnValue(null)
    // Default: user has seen done-generate (no celebrate). Individual tests
    // flip to false to exercise the celebrate path.
    mockHasSeenDoneGenerate.mockReturnValue(true)
    // Default: SWR returns no data (status not yet polled / not in-flight).
    mockUseSWR.mockReturnValue({ data: undefined })
  })

  it('fabVisible:true → renders <OnboardingFab> with the derived fabState', () => {
    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'working' },
      'in_progress'
    )

    const fab = screen.getByTestId('onboarding-fab-stub')
    expect(fab).toBeInTheDocument()
    expect(fab).toHaveAttribute('data-fab-state', 'working')
  })

  it('fabVisible:false → does NOT render <OnboardingFab>', () => {
    renderHemPage({ firstRunOpen: false, fabVisible: false, fabState: 'idle' })

    expect(screen.queryByTestId('onboarding-fab-stub')).not.toBeInTheDocument()
  })

  it('URL ?onboarding=tutorial&tab=ai-agent → mounts FirstRunModal at tutorial-only with deep-link tab', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === 'onboarding') return 'tutorial'
      if (key === 'tab') return 'ai-agent'
      return null
    })

    renderHemPage({ firstRunOpen: false, fabVisible: false, fabState: 'idle' })

    const modal = screen.getByTestId('first-run-modal-stub')
    expect(modal).toHaveAttribute('data-initial-step', 'tutorial-only')
    expect(modal).toHaveAttribute('data-initial-tab', 'ai-agent')
    expect(modal).toHaveAttribute('data-open-trigger', 'help_menu')
  })

  it('URL ?onboarding=tutorial without &tab= → mounts FirstRunModal at tutorial-only with default tab', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === 'onboarding') return 'tutorial'
      return null
    })

    renderHemPage({ firstRunOpen: false, fabVisible: false, fabState: 'idle' })

    const modal = screen.getByTestId('first-run-modal-stub')
    expect(modal).toHaveAttribute('data-initial-step', 'tutorial-only')
    expect(modal).toHaveAttribute('data-initial-tab', '')
  })

  it('URL ?onboarding=tutorial&tab=garbage → falls back to default tab (invalid validated away)', () => {
    mockSearchParamsGet.mockImplementation((key) => {
      if (key === 'onboarding') return 'tutorial'
      if (key === 'tab') return 'not-a-real-tab'
      return null
    })

    renderHemPage({ firstRunOpen: false, fabVisible: false, fabState: 'idle' })

    const modal = screen.getByTestId('first-run-modal-stub')
    expect(modal).toHaveAttribute('data-initial-tab', '')
  })

  it('B.6 AC 32: fabVisible:true hides the LawListGenerationProgress banner', () => {
    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'working' },
      'in_progress'
    )

    expect(
      screen.queryByTestId('law-list-generation-progress-stub')
    ).not.toBeInTheDocument()
  })

  it('B.6 AC 33 scenario 2: FAB dismissed + status in flight → banner DOES render', () => {
    renderHemPage(
      { firstRunOpen: false, fabVisible: false, fabState: 'idle' },
      'in_progress'
    )

    expect(
      screen.getByTestId('law-list-generation-progress-stub')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('onboarding-fab-stub')).not.toBeInTheDocument()
  })

  // Story 25.6 v1.1 — celebrate state derivation tests.
  it('hasSeenDoneGenerate=false + fabState=done → FAB celebrate=true', async () => {
    mockHasSeenDoneGenerate.mockReturnValue(false)

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'done' },
      'completed'
    )

    // useEffect-driven flip — wait for it
    const fab = await screen.findByTestId('onboarding-fab-stub')
    await waitFor(() => {
      expect(fab).toHaveAttribute('data-celebrate', 'true')
    })
  })

  it('hasSeenDoneGenerate=true + fabState=done → FAB celebrate=false', async () => {
    mockHasSeenDoneGenerate.mockReturnValue(true)

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'done' },
      'completed'
    )

    const fab = await screen.findByTestId('onboarding-fab-stub')
    expect(fab).toHaveAttribute('data-celebrate', 'false')
  })

  it('hasSeenDoneGenerate=false + URL ?onboarding=tutorial → modal opens at done-generate', async () => {
    mockHasSeenDoneGenerate.mockReturnValue(false)
    mockSearchParamsGet.mockImplementation((key) =>
      key === 'onboarding' ? 'tutorial' : null
    )

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'done' },
      'completed'
    )

    const modal = await screen.findByTestId('first-run-modal-stub')
    await waitFor(() => {
      expect(modal).toHaveAttribute('data-initial-step', 'done-generate')
    })
  })

  it('hasSeenDoneGenerate=true + URL ?onboarding=tutorial + completed → modal opens at tutorial-only', async () => {
    mockHasSeenDoneGenerate.mockReturnValue(true)
    mockSearchParamsGet.mockImplementation((key) =>
      key === 'onboarding' ? 'tutorial' : null
    )

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'done' },
      'completed'
    )

    const modal = await screen.findByTestId('first-run-modal-stub')
    expect(modal).toHaveAttribute('data-initial-step', 'tutorial-only')
  })

  // Story 25.6 v1.1 — SWR-driven background polling fires router.refresh()
  // when generation completes mid-minimize so the FAB visual updates without
  // a manual reload.
  it('background SWR poll: status flip to completed → router.refresh() fires once', async () => {
    mockUseSWR.mockReturnValue({ data: { status: 'completed' } })

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'working' },
      'in_progress'
    )

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it('background SWR poll: status still in_progress → router.refresh() NOT fired', async () => {
    mockUseSWR.mockReturnValue({ data: { status: 'in_progress' } })

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'working' },
      'in_progress'
    )

    // Give effects time to run
    await waitFor(() => {
      expect(mockHasSeenDoneGenerate).toHaveBeenCalled()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('background SWR poll: failed status also fires router.refresh()', async () => {
    mockUseSWR.mockReturnValue({ data: { status: 'failed' } })

    renderHemPage(
      { firstRunOpen: false, fabVisible: true, fabState: 'working' },
      'in_progress'
    )

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })
})

/**
 * Story 25.0 (Epic 25): unit tests for getOnboardingState — the pure
 * server-side derivation that decides whether the dashboard auto-opens the
 * first-run path-choice modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

import { getOnboardingState } from '@/lib/onboarding/get-onboarding-state'

const FRESH = new Date() // created just now
const STALE = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25h ago — past the 24h cap

const SAFE_DEFAULT = {
  firstRunOpen: false,
  fabVisible: false,
  fabState: 'idle' as const,
}

describe('getOnboardingState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fresh workspace + no dismissal + null status → firstRunOpen true', async () => {
    mockFindUnique.mockResolvedValue({
      created_at: FRESH,
      first_run_dismissed_at: null,
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
    })

    const state = await getOnboardingState('ws_1')

    expect(state).toEqual({
      firstRunOpen: true,
      fabVisible: false,
      fabState: 'idle',
    })
  })

  it('fresh workspace + already dismissed → firstRunOpen false', async () => {
    mockFindUnique.mockResolvedValue({
      created_at: FRESH,
      first_run_dismissed_at: new Date(),
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
    })

    expect((await getOnboardingState('ws_1')).firstRunOpen).toBe(false)
  })

  it.each(['pending', 'in_progress', 'completed', 'failed', 'skipped'])(
    'fresh workspace + null dismissal + status=%s → firstRunOpen false',
    async (status) => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: null,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: status,
      })

      expect((await getOnboardingState('ws_1')).firstRunOpen).toBe(false)
    }
  )

  it('stale workspace (>24h old) → firstRunOpen false', async () => {
    mockFindUnique.mockResolvedValue({
      created_at: STALE,
      first_run_dismissed_at: null,
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
    })

    expect((await getOnboardingState('ws_1')).firstRunOpen).toBe(false)
  })

  it('workspace not found → safe default', async () => {
    mockFindUnique.mockResolvedValue(null)

    expect(await getOnboardingState('ws_missing')).toEqual(SAFE_DEFAULT)
  })

  it('DB error → safe default (never throws)', async () => {
    mockFindUnique.mockRejectedValue(new Error('connection refused'))

    expect(await getOnboardingState('ws_1')).toEqual(SAFE_DEFAULT)
  })

  it('always returns fabVisible:false and fabState:idle in B.0', async () => {
    mockFindUnique.mockResolvedValue({
      created_at: FRESH,
      first_run_dismissed_at: null,
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
    })

    const state = await getOnboardingState('ws_1')

    expect(state.fabVisible).toBe(false)
    expect(state.fabState).toBe('idle')
  })
})

/**
 * Story 25.0 (Epic 25): unit tests for getOnboardingState — the pure
 * server-side derivation that decides whether the dashboard auto-opens the
 * first-run path-choice modal.
 *
 * Story 25.6 (B.6): tests extended for the fabVisible + fabState derivation
 * lit up in B.6 (previously stubbed to false/idle).
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

  it('pre-B.6 invariant: firstRunOpen=true → fabVisible=false (mutually exclusive)', async () => {
    mockFindUnique.mockResolvedValue({
      created_at: FRESH,
      first_run_dismissed_at: null,
      tutorial_fab_dismissed_at: null,
      law_list_generation_status: null,
    })

    const state = await getOnboardingState('ws_1')

    expect(state.firstRunOpen).toBe(true)
    expect(state.fabVisible).toBe(false)
  })

  // Story 25.6 (B.6) — fabVisible + fabState derivation tests.
  // Common base: workspace dismissed (so fabVisible can be true).
  describe('B.6: fabVisible + fabState derivation', () => {
    const dismissed = new Date(Date.now() - 60 * 1000) // 1 min ago

    it('dismissed + FAB not dismissed + status=null → fabVisible:true, fabState:idle', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: null,
      })

      const state = await getOnboardingState('ws_1')

      expect(state.fabVisible).toBe(true)
      expect(state.fabState).toBe('idle')
      expect(state.firstRunOpen).toBe(false) // mutual exclusion
    })

    it('dismissed + status=pending → fabVisible:true, fabState:working', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: 'pending',
      })

      const state = await getOnboardingState('ws_1')

      expect(state.fabVisible).toBe(true)
      expect(state.fabState).toBe('working')
    })

    it('dismissed + status=in_progress → fabVisible:true, fabState:working', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: 'in_progress',
      })

      const state = await getOnboardingState('ws_1')

      expect(state.fabVisible).toBe(true)
      expect(state.fabState).toBe('working')
    })

    it('dismissed + status=completed → fabVisible:true, fabState:done', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: 'completed',
      })

      const state = await getOnboardingState('ws_1')

      expect(state.fabVisible).toBe(true)
      expect(state.fabState).toBe('done')
    })

    it('dismissed + status=skipped → fabVisible:false (excluded)', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: 'skipped',
      })

      expect((await getOnboardingState('ws_1')).fabVisible).toBe(false)
    })

    it('FAB already dismissed → fabVisible:false', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: new Date(),
        law_list_generation_status: 'completed',
      })

      expect((await getOnboardingState('ws_1')).fabVisible).toBe(false)
    })

    it('stale workspace (>24h) + dismissed + FAB not dismissed → fabVisible:true (24h cap does NOT apply to FAB)', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: STALE,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: null,
      })

      const state = await getOnboardingState('ws_1')

      expect(state.firstRunOpen).toBe(false) // FRESH guard fails
      expect(state.fabVisible).toBe(true) // no FRESH guard on FAB
    })

    it('failed status keeps fabState=idle (failed maps to neither working nor done)', async () => {
      mockFindUnique.mockResolvedValue({
        created_at: FRESH,
        first_run_dismissed_at: dismissed,
        tutorial_fab_dismissed_at: null,
        law_list_generation_status: 'failed',
      })

      expect((await getOnboardingState('ws_1')).fabState).toBe('idle')
    })
  })
})

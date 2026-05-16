/**
 * Story 25.0 (Epic 25): unit tests for the five onboarding-modal server
 * actions. Covers the happy path, the auth gate, the fail-safe telemetry
 * write, and the action-specific behaviours (skip writes both columns,
 * recordTabViewed is idempotent).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWsUpdate = vi.fn()
const mockWsFindUnique = vi.fn()
const mockEventCreate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      update: (...args: unknown[]) => mockWsUpdate(...args),
      findUnique: (...args: unknown[]) => mockWsFindUnique(...args),
    },
    onboardingEvent: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
  },
}))

const MOCK_WS = 'ws-1'
const MOCK_USER = 'user-1'

// Default mock: withWorkspace just invokes the callback with a fixed context.
// Individual tests override with mockImplementationOnce to simulate auth failure.
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>
    ) => fn({ workspaceId: MOCK_WS, userId: MOCK_USER })
  ),
}))

import {
  minimiseFirstRunModal,
  skipLawListGeneration,
  dismissOnboardingFab,
  recordTabViewed,
  recordOnboardingEvent,
} from '@/app/actions/onboarding-modal'
import { withWorkspace } from '@/lib/auth/workspace-context'

beforeEach(() => {
  vi.clearAllMocks()
  mockWsUpdate.mockResolvedValue({})
  mockEventCreate.mockResolvedValue({})
  mockWsFindUnique.mockResolvedValue({ first_run_tabs_viewed: [] })
})

describe('minimiseFirstRunModal', () => {
  it('happy path — sets first_run_dismissed_at + writes modal_dismissed event', async () => {
    const result = await minimiseFirstRunModal()

    expect(result).toEqual({ ok: true })
    expect(mockWsUpdate).toHaveBeenCalledWith({
      where: { id: MOCK_WS },
      data: { first_run_dismissed_at: expect.any(Date) },
    })
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: MOCK_WS,
        user_id: MOCK_USER,
        event_type: 'modal_dismissed',
        payload: { from_state: 'path_choice' },
      },
    })
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(minimiseFirstRunModal()).rejects.toThrow('Unauthorized')
  })

  it('primary write failure → returns { ok: false }', async () => {
    mockWsUpdate.mockRejectedValueOnce(new Error('db down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await minimiseFirstRunModal()

    expect(result).toEqual({ ok: false, error: expect.any(String) })
    errSpy.mockRestore()
  })

  it('event-write failure is swallowed — still returns { ok: true }', async () => {
    mockEventCreate.mockRejectedValueOnce(new Error('event table gone'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await minimiseFirstRunModal()

    expect(result).toEqual({ ok: true })
    expect(errSpy).toHaveBeenCalledWith(
      '[ONBOARDING_EVENT_WRITE_FAIL]',
      'modal_dismissed',
      expect.any(Error)
    )
    errSpy.mockRestore()
  })
})

describe('skipLawListGeneration', () => {
  it('happy path — sets BOTH columns in one update + writes path_chosen event', async () => {
    const result = await skipLawListGeneration()

    expect(result).toEqual({ ok: true })
    expect(mockWsUpdate).toHaveBeenCalledWith({
      where: { id: MOCK_WS },
      data: {
        law_list_generation_status: 'skipped',
        first_run_dismissed_at: expect.any(Date),
      },
    })
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: MOCK_WS,
        user_id: MOCK_USER,
        event_type: 'path_chosen',
        payload: { path: 'skipped' },
      },
    })
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(skipLawListGeneration()).rejects.toThrow('Unauthorized')
  })
})

describe('dismissOnboardingFab', () => {
  it('happy path — sets tutorial_fab_dismissed_at + writes fab_dismissed event', async () => {
    const result = await dismissOnboardingFab()

    expect(result).toEqual({ ok: true })
    expect(mockWsUpdate).toHaveBeenCalledWith({
      where: { id: MOCK_WS },
      data: { tutorial_fab_dismissed_at: expect.any(Date) },
    })
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event_type: 'fab_dismissed' }),
      })
    )
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(dismissOnboardingFab()).rejects.toThrow('Unauthorized')
  })
})

describe('recordTabViewed', () => {
  it('appends a new tab id to first_run_tabs_viewed', async () => {
    mockWsFindUnique.mockResolvedValueOnce({
      first_run_tabs_viewed: ['laglista'],
    })

    const result = await recordTabViewed('kravpunkter')

    expect(result).toEqual({ ok: true })
    expect(mockWsUpdate).toHaveBeenCalledWith({
      where: { id: MOCK_WS },
      data: { first_run_tabs_viewed: ['laglista', 'kravpunkter'] },
    })
  })

  it('is idempotent — does not update when the tab id is already present', async () => {
    mockWsFindUnique.mockResolvedValueOnce({
      first_run_tabs_viewed: ['laglista', 'kravpunkter'],
    })

    const result = await recordTabViewed('kravpunkter')

    expect(result).toEqual({ ok: true })
    expect(mockWsUpdate).not.toHaveBeenCalled()
    // the tab_viewed event is still written even on the idempotent path
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: 'tab_viewed',
          payload: { tab_id: 'kravpunkter' },
        }),
      })
    )
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(recordTabViewed('laglista')).rejects.toThrow('Unauthorized')
  })
})

describe('recordOnboardingEvent', () => {
  it('happy path — writes the event row and returns { ok: true }', async () => {
    const result = await recordOnboardingEvent('modal_opened', {
      trigger: 'first_run',
    })

    expect(result).toEqual({ ok: true })
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: MOCK_WS,
        user_id: MOCK_USER,
        event_type: 'modal_opened',
        payload: { trigger: 'first_run' },
      },
    })
  })

  it('best-effort — returns { ok: true } even when the row write fails', async () => {
    mockEventCreate.mockRejectedValueOnce(new Error('event table gone'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await recordOnboardingEvent('path_chosen', {
      path: 'generate',
    })

    expect(result).toEqual({ ok: true })
    expect(errSpy).toHaveBeenCalledWith(
      '[ONBOARDING_EVENT_WRITE_FAIL]',
      'path_chosen',
      expect.any(Error)
    )
    errSpy.mockRestore()
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(
      recordOnboardingEvent('modal_opened', { trigger: 'first_run' })
    ).rejects.toThrow('Unauthorized')
  })
})

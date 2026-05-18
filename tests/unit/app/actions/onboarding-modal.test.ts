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
const mockUserFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      update: (...args: unknown[]) => mockWsUpdate(...args),
      findUnique: (...args: unknown[]) => mockWsFindUnique(...args),
    },
    onboardingEvent: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// Story 25.5: sendEmail mocked at the module level. Individual tests override
// with mockImplementationOnce / mockRejectedValueOnce for transport-failure
// scenarios.
const mockSendEmail = vi.fn()
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// Story 25.5: the React Email component is invoked as a function in the
// action body (via ProductFeedbackInternalEmail({...}) — not <JSX>). Mock to
// a sentinel so tests can assert it was called with the right props without
// running the actual React Email render machinery.
const mockEmailComponent = vi.fn(() => 'EMAIL_ELEMENT_SENTINEL')
vi.mock('@/emails/product-feedback-internal', () => ({
  ProductFeedbackInternalEmail: (props: unknown) => mockEmailComponent(props),
}))

const MOCK_WS = 'ws-1'
const MOCK_USER = 'user-1'
const MOCK_WS_NAME = 'Almåsa AB'

// Default mock: withWorkspace just invokes the callback with a fixed context.
// Individual tests override with mockImplementationOnce to simulate auth failure.
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: {
        workspaceId: string
        userId: string
        workspaceName: string
      }) => Promise<unknown>
    ) =>
      fn({
        workspaceId: MOCK_WS,
        userId: MOCK_USER,
        workspaceName: MOCK_WS_NAME,
      })
  ),
}))

import {
  minimiseFirstRunModal,
  skipLawListGeneration,
  dismissOnboardingFab,
  recordTabViewed,
  recordOnboardingEvent,
  submitProductFeedback,
} from '@/app/actions/onboarding-modal'
import { withWorkspace } from '@/lib/auth/workspace-context'

beforeEach(() => {
  vi.clearAllMocks()
  mockWsUpdate.mockResolvedValue({})
  mockEventCreate.mockResolvedValue({})
  mockWsFindUnique.mockResolvedValue({ first_run_tabs_viewed: [] })
  mockUserFindUnique.mockResolvedValue({
    email: 'session@example.com',
    name: 'Test User',
  })
  mockSendEmail.mockResolvedValue({ success: true })
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

describe('submitProductFeedback', () => {
  it('happy path (sentiment only) — writes event with session-email fallback + sends email + returns { ok: true }', async () => {
    const result = await submitProductFeedback({ sentiment: 'positive' })

    expect(result).toEqual({ ok: true })

    // Event row written with session email as the reply-to fallback
    expect(mockEventCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: MOCK_WS,
        user_id: MOCK_USER,
        event_type: 'feedback_submitted',
        payload: {
          sentiment: 'positive',
          message: null,
          email: 'session@example.com',
          source: 'onboarding_modal_feedback_tab',
        },
      },
    })

    // sendEmail called with correct subject + recipient + sender
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'dev@laglig.se',
        subject: `[Produkt-feedback] 👍 från ${MOCK_WS_NAME}`,
        from: 'no-reply',
        react: 'EMAIL_ELEMENT_SENTINEL',
      })
    )

    // Email component received the right props
    expect(mockEmailComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment: 'positive',
        workspaceName: MOCK_WS_NAME,
        workspaceId: MOCK_WS,
        userEmail: 'session@example.com',
        replyToEmail: 'session@example.com',
        message: null,
        source: 'onboarding_modal_feedback_tab',
      })
    )
  })

  it('happy path (sentiment + message + email) — all three flow to event + email props', async () => {
    const result = await submitProductFeedback({
      sentiment: 'negative',
      message: '  bug in lagändringar tab  ',
      email: '  user@example.com  ',
    })

    expect(result).toEqual({ ok: true })

    expect(mockEventCreate).toHaveBeenCalledWith({
      data: {
        workspace_id: MOCK_WS,
        user_id: MOCK_USER,
        event_type: 'feedback_submitted',
        payload: {
          sentiment: 'negative',
          message: 'bug in lagändringar tab', // trimmed server-side
          email: 'user@example.com', // user-entered (not session fallback)
          source: 'onboarding_modal_feedback_tab',
        },
      },
    })

    expect(mockEmailComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        sentiment: 'negative',
        userEmail: 'session@example.com',
        replyToEmail: 'user@example.com',
        message: 'bug in lagändringar tab',
        source: 'onboarding_modal_feedback_tab',
      })
    )

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: `[Produkt-feedback] 👎 från ${MOCK_WS_NAME}`,
      })
    )
  })

  it('validation — rejects invalid sentiment and writes no event / no email', async () => {
    const result = await submitProductFeedback({
      // @ts-expect-error — intentionally invalid for the test
      sentiment: 'meh',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Välj en tumme upp eller ner.',
    })
    expect(mockEventCreate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('validation — rejects invalid email regex and writes no event / no email', async () => {
    const result = await submitProductFeedback({
      sentiment: 'positive',
      email: 'not-an-email',
    })

    expect(result).toEqual({ ok: false, error: 'Ogiltig e-postadress.' })
    expect(mockEventCreate).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('auth gate — propagates when withWorkspace rejects', async () => {
    vi.mocked(withWorkspace).mockImplementationOnce(async () => {
      throw new Error('Unauthorized')
    })

    await expect(
      submitProductFeedback({ sentiment: 'positive' })
    ).rejects.toThrow('Unauthorized')
  })

  it('email-transport failure is swallowed — event row still written, returns { ok: true }', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('resend down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await submitProductFeedback({ sentiment: 'positive' })

    expect(result).toEqual({ ok: true })
    expect(mockEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event_type: 'feedback_submitted' }),
      })
    )
    expect(errSpy).toHaveBeenCalledWith(
      '[PRODUCT_FEEDBACK_EMAIL_FAIL]',
      expect.any(Error)
    )
    errSpy.mockRestore()
  })

  it('payload carries the source discriminator on every happy-path write', async () => {
    await submitProductFeedback({ sentiment: 'positive' })

    const writtenPayload = mockEventCreate.mock.calls[0]?.[0]?.data?.payload
    expect(writtenPayload).toMatchObject({
      source: 'onboarding_modal_feedback_tab',
    })
  })
})

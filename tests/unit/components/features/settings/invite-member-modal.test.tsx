/**
 * Story 5.3 follow-up (QA gate TEST-002): React Testing Library coverage
 * for the InviteMemberModal — validation, success path, error path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteMemberModal } from '@/components/features/settings/invite-member-modal'

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const originalFetch = global.fetch

function mockFetchOnce(response: {
  ok: boolean
  status?: number
  body?: unknown
}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.body ?? {},
  }) as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

// Radix's Select portals the dropdown into document.body, which happy-dom
// handles as long as pointer capture is shimmed (already done in
// tests/setup.ts). For these tests we only need to change the role via
// its native-ish <SelectTrigger> which shadcn renders as a button.

describe('InviteMemberModal', () => {
  function renderModal(
    overrides: {
      onInvited?: () => void
      onOpenChange?: (_open: boolean) => void
    } = {}
  ) {
    const onInvited = overrides.onInvited ?? vi.fn()
    const onOpenChange = overrides.onOpenChange ?? vi.fn()
    render(
      <InviteMemberModal
        open={true}
        onOpenChange={onOpenChange}
        onInvited={onInvited}
        seatUsage={null}
      />
    )
    return { onInvited, onOpenChange }
  }

  it('renders the dialog with the expected fields and submit CTA', () => {
    renderModal()
    expect(screen.getByText('Bjud in medlem')).toBeInTheDocument()
    expect(screen.getByLabelText(/E-postadress/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Roll/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /skicka inbjudan/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /avbryt/i })).toBeInTheDocument()
  })

  it('shows a validation error on invalid email format', async () => {
    const user = userEvent.setup()
    // Spy on fetch so we can assert it wasn't called
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    renderModal()
    await user.type(screen.getByLabelText(/E-postadress/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /skicka inbjudan/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ogiltig/i)
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to /api/workspace/invitations and closes on success', async () => {
    const user = userEvent.setup()
    mockFetchOnce({ ok: true, body: { success: true, id: 'inv-1' } })
    const { onInvited, onOpenChange } = renderModal()

    await user.type(screen.getByLabelText(/E-postadress/i), 'new@example.com')
    await user.click(screen.getByRole('button', { name: /skicka inbjudan/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/workspace/invitations',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body as string)
    expect(body).toEqual({ email: 'new@example.com', role: 'MEMBER' })

    expect(mockToastSuccess).toHaveBeenCalled()
    expect(onInvited).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces the server error message when the API responds non-OK', async () => {
    const user = userEvent.setup()
    mockFetchOnce({
      ok: false,
      status: 400,
      body: { error: 'Användaren är redan medlem i arbetsplatsen' },
    })
    const { onInvited, onOpenChange } = renderModal()

    await user.type(screen.getByLabelText(/E-postadress/i), 'dupe@example.com')
    await user.click(screen.getByRole('button', { name: /skicka inbjudan/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/redan medlem/i)
    })
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(onInvited).not.toHaveBeenCalled()
    // Modal stays open so the user can correct the input
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('shows a network-error message when fetch throws', async () => {
    const user = userEvent.setup()
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as typeof fetch
    renderModal()

    await user.type(screen.getByLabelText(/E-postadress/i), 'a@b.se')
    fireEvent.click(screen.getByRole('button', { name: /skicka inbjudan/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/nätverksfel/i)
    })
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('disables the submit button while in-flight', async () => {
    let resolveFetch: ((_v: unknown) => void) | undefined
    const pending = new Promise((r) => {
      resolveFetch = r
    })
    global.fetch = vi.fn().mockReturnValue(pending) as typeof fetch

    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/E-postadress/i), 'slow@example.com')
    const submitBtn = screen.getByRole('button', { name: /skicka inbjudan/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(submitBtn).toBeDisabled()
    })

    // Resolve to let the component settle before the test tears down
    resolveFetch?.({ ok: true, json: async () => ({ success: true }) })
  })
})

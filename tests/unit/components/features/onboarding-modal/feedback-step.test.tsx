/**
 * Story 25.5 (Epic 25, B.5): component test for <FeedbackStep>.
 *
 * Covers initial render, sentiment toggle semantics, char counter visibility,
 * happy-path submit + transition to confirmation, failed-submit toast +
 * field preservation, and reset behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'

const mockSubmit = vi.fn()
vi.mock('@/app/actions/onboarding-modal', () => ({
  submitProductFeedback: (input: unknown) => mockSubmit(input),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

import { FeedbackStep } from '@/components/features/onboarding-modal/feedback-step'

describe('<FeedbackStep>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: submit succeeds.
    mockSubmit.mockResolvedValue({ ok: true })
  })

  it('renders eyebrow, headline, both thumbs buttons, textarea, email input, and submit', () => {
    render(<FeedbackStep />)

    expect(screen.getByText('Feedback')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Vad tycker du om Laglig.se?' })
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Bra' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dåligt' })).toBeInTheDocument()
    expect(screen.getByLabelText('Meddelande (valfritt)')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Reply-to e-post (valfritt)')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Skicka feedback' })
    ).toBeInTheDocument()
  })

  it('disables the submit button until a sentiment is selected', () => {
    render(<FeedbackStep />)
    const submit = screen.getByRole('button', { name: 'Skicka feedback' })
    expect(submit).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: 'Bra' }))
    expect(submit).toBeEnabled()
  })

  it('flips aria-checked between the two thumbs (radio semantics)', () => {
    render(<FeedbackStep />)
    const up = screen.getByRole('radio', { name: 'Bra' })
    const down = screen.getByRole('radio', { name: 'Dåligt' })

    expect(up).toHaveAttribute('aria-checked', 'false')
    expect(down).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(up)
    expect(up).toHaveAttribute('aria-checked', 'true')
    expect(down).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(down)
    expect(up).toHaveAttribute('aria-checked', 'false')
    expect(down).toHaveAttribute('aria-checked', 'true')
  })

  it('only renders the char counter when message length > 0; caps input at 500', () => {
    render(<FeedbackStep />)
    expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument()

    const textarea = screen.getByLabelText('Meddelande (valfritt)')
    fireEvent.change(textarea, { target: { value: 'hej' } })
    expect(screen.getByText('3 / 500')).toBeInTheDocument()

    // Cap behaviour: paste a 600-char string, slice keeps 500.
    const long = 'x'.repeat(600)
    fireEvent.change(textarea, { target: { value: long } })
    expect(screen.getByText('500 / 500')).toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toHaveLength(500)
  })

  it('calls submitProductFeedback with trimmed payload and transitions to confirmation on success', async () => {
    render(<FeedbackStep />)

    fireEvent.click(screen.getByRole('radio', { name: 'Dåligt' }))
    fireEvent.change(screen.getByLabelText('Meddelande (valfritt)'), {
      target: { value: '  feedback text  ' },
    })
    fireEvent.change(screen.getByLabelText('Reply-to e-post (valfritt)'), {
      target: { value: '  user@example.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Skicka feedback' }))

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        sentiment: 'negative',
        message: 'feedback text',
        email: 'user@example.com',
      })
    })

    // Confirmation state replaces the form
    expect(
      await screen.findByRole('heading', { name: 'Tack — vi läser allt.' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Skicka en till/ })
    ).toBeInTheDocument()
  })

  it('keeps field values + fires toast.error on failed submit', async () => {
    mockSubmit.mockResolvedValueOnce({
      ok: false,
      error: 'Ogiltig e-postadress.',
    })
    render(<FeedbackStep />)

    fireEvent.click(screen.getByRole('radio', { name: 'Bra' }))
    fireEvent.change(screen.getByLabelText('Meddelande (valfritt)'), {
      target: { value: 'still here' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Skicka feedback' }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ogiltig e-postadress.')
    })

    // Form stays mounted with the field value preserved
    expect(screen.getByLabelText('Meddelande (valfritt)')).toHaveValue(
      'still here'
    )
    expect(
      screen.queryByRole('heading', { name: 'Tack — vi läser allt.' })
    ).not.toBeInTheDocument()
  })

  it('resets the form when "Skicka en till" is clicked from the confirmation state', async () => {
    render(<FeedbackStep />)

    fireEvent.click(screen.getByRole('radio', { name: 'Bra' }))
    fireEvent.change(screen.getByLabelText('Meddelande (valfritt)'), {
      target: { value: 'first round' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Skicka feedback' }))

    const resetLink = await screen.findByRole('button', {
      name: /Skicka en till/,
    })
    fireEvent.click(resetLink)

    // Form is back; submit disabled again; fields empty
    const submit = screen.getByRole('button', { name: 'Skicka feedback' })
    expect(submit).toBeDisabled()
    expect(screen.getByLabelText('Meddelande (valfritt)')).toHaveValue('')
    expect(screen.getByLabelText('Reply-to e-post (valfritt)')).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Bra' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    expect(screen.getByRole('radio', { name: 'Dåligt' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })
})

// suppress unused-import warning for `within` (kept for future test growth)
void within

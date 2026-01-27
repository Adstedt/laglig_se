import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatError } from '@/components/features/ai-chat/chat-error'

describe('ChatError', () => {
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    mockOnRetry.mockClear()
  })

  it('displays default error message for null error', () => {
    render(<ChatError error={null} onRetry={mockOnRetry} />)
    expect(
      screen.getByText('Ett oväntat fel uppstod. Försök igen.')
    ).toBeInTheDocument()
  })

  it('displays network error message', () => {
    render(
      <ChatError error={new Error('network error')} onRetry={mockOnRetry} />
    )
    expect(
      screen.getByText(/Kunde inte ansluta till servern/)
    ).toBeInTheDocument()
  })

  it('displays timeout error message', () => {
    render(<ChatError error={new Error('timeout')} onRetry={mockOnRetry} />)
    expect(screen.getByText(/Förfrågan tog för lång tid/)).toBeInTheDocument()
  })

  it('displays rate limit error message with countdown', () => {
    render(
      <ChatError
        error={new Error('429 rate limit')}
        onRetry={mockOnRetry}
        retryAfter={30}
      />
    )
    expect(screen.getByText(/För många förfrågningar.*30/)).toBeInTheDocument()
  })

  it('displays retry button', () => {
    render(<ChatError error={new Error('test error')} onRetry={mockOnRetry} />)
    expect(
      screen.getByRole('button', { name: /försök igen/i })
    ).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChatError error={new Error('test error')} onRetry={mockOnRetry} />)

    await user.click(screen.getByRole('button', { name: /försök igen/i }))

    expect(mockOnRetry).toHaveBeenCalled()
  })

  it('shows countdown button when rate limited', () => {
    render(
      <ChatError
        error={new Error('429 rate limit')}
        onRetry={mockOnRetry}
        retryAfter={30}
      />
    )
    expect(screen.getByText(/Väntar.*30s/)).toBeInTheDocument()
  })

  it('has alert role for accessibility', () => {
    render(<ChatError error={new Error('test')} onRetry={mockOnRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

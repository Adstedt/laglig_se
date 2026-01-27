import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreamingIndicator } from '@/components/features/ai-chat/streaming-indicator'

describe('StreamingIndicator', () => {
  it('renders streaming indicator', () => {
    render(<StreamingIndicator />)
    expect(screen.getByText('AI skriver')).toBeInTheDocument()
  })

  it('has correct aria-label for accessibility', () => {
    render(<StreamingIndicator />)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'AI skriver...'
    )
  })

  it('renders three animated dots', () => {
    render(<StreamingIndicator />)
    const dots = document.querySelectorAll('.animate-bounce')
    expect(dots).toHaveLength(3)
  })

  it('applies custom className', () => {
    const { container } = render(
      <StreamingIndicator className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

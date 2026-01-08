/**
 * Story 6.3: Lagtext Section Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LagtextSection } from '@/components/features/document-list/legal-document-modal/lagtext-section'

// Mock the LawContentWrapper component
vi.mock('@/app/(public)/lagar/[id]/law-content-wrapper', () => ({
  LawContentWrapper: ({
    htmlContent,
    fallbackText,
  }: {
    htmlContent: string
    fallbackText?: string | null
  }) => <div data-testid="law-content">{htmlContent || fallbackText}</div>,
}))

describe('LagtextSection', () => {
  const defaultProps = {
    htmlContent:
      '<p>This is some legal text content that should be displayed in the section.</p>',
    fullText: 'Plain text fallback',
    slug: '1977-1160',
    sourceUrl: null,
  }

  it('renders with content', () => {
    render(<LagtextSection {...defaultProps} />)

    expect(screen.getByText('Lagtext')).toBeInTheDocument()
    expect(screen.getByTestId('law-content')).toBeInTheDocument()
  })

  it('shows collapsed view by default with "Visa mer" button', () => {
    render(<LagtextSection {...defaultProps} />)

    expect(
      screen.getByRole('button', { name: /visa mer/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /visa mindre/i })
    ).not.toBeInTheDocument()
  })

  it('expands when "Visa mer" is clicked', async () => {
    const user = userEvent.setup()
    render(<LagtextSection {...defaultProps} />)

    const expandButton = screen.getByRole('button', { name: /visa mer/i })
    await user.click(expandButton)

    expect(
      screen.getByRole('button', { name: /visa mindre/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /visa mer/i })
    ).not.toBeInTheDocument()
  })

  it('collapses when "Visa mindre" is clicked', async () => {
    const user = userEvent.setup()
    render(<LagtextSection {...defaultProps} />)

    // First expand
    await user.click(screen.getByRole('button', { name: /visa mer/i }))
    // Then collapse (has a 150ms delay for scroll animation)
    await user.click(screen.getByRole('button', { name: /visa mindre/i }))

    // Wait for the collapse animation to complete
    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: /visa mer/i })
        ).toBeInTheDocument()
      },
      { timeout: 500 }
    )
  })

  it('shows placeholder for null content', () => {
    render(
      <LagtextSection {...defaultProps} htmlContent={null} fullText={null} />
    )

    expect(screen.getByText(/lagtext ej tillgänglig/i)).toBeInTheDocument()
  })

  it('always shows "Visa på egen sida" link', () => {
    render(<LagtextSection {...defaultProps} />)

    const link = screen.getByRole('link', { name: /visa på egen sida/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/browse/lagar/1977-1160')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows PDF link when sourceUrl is PDF', () => {
    render(
      <LagtextSection
        {...defaultProps}
        sourceUrl="https://example.com/law.pdf"
      />
    )

    const pdfLink = screen.getByRole('link', { name: /ladda ner pdf/i })
    expect(pdfLink).toBeInTheDocument()
    expect(pdfLink).toHaveAttribute('href', 'https://example.com/law.pdf')
  })

  it('hides PDF link when sourceUrl is not PDF', () => {
    render(
      <LagtextSection
        {...defaultProps}
        sourceUrl="https://example.com/law.html"
      />
    )

    expect(
      screen.queryByRole('link', { name: /ladda ner pdf/i })
    ).not.toBeInTheDocument()
  })

  it('hides PDF link when sourceUrl is null', () => {
    render(<LagtextSection {...defaultProps} sourceUrl={null} />)

    expect(
      screen.queryByRole('link', { name: /ladda ner pdf/i })
    ).not.toBeInTheDocument()
  })

  it('applies custom max heights', () => {
    const { container } = render(
      <LagtextSection
        {...defaultProps}
        maxCollapsedHeight={200}
        maxExpandedHeight={400}
      />
    )

    // The container with max-height is the parent div of LawContentWrapper
    const contentContainer = container.querySelector('.transition-all')
    expect(contentContainer).toHaveStyle({ maxHeight: '200px' })
  })
})

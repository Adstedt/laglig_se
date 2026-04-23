/**
 * Story 21.16 follow-up — BusinessContextReadOnly tests.
 * Read-only "Hur påverkar detta oss?" renderer for the cycle-item modal.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BusinessContextReadOnly } from '@/components/features/compliance-audit/cycle-item-modal/business-context-readonly'

// Stub next/link — RTL + JSDOM don't need the client navigation, and tests
// just assert on the rendered <a> attributes.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Stub RichTextDisplay — it's tested separately. We verify the wiring (prop
// passthrough + rendering) via a simple span marker.
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextDisplay: ({ content }: { content: string }) => (
    <span data-testid="rich-text-display">{content}</span>
  ),
}))

const LAW_LIST_ITEM_ID = 'li-abc-123'

describe('BusinessContextReadOnly', () => {
  afterEach(() => cleanup())

  it('renders content via RichTextDisplay when non-empty', () => {
    render(
      <BusinessContextReadOnly
        content="Vi hanterar kemikalier dagligen — riskbedömning krävs kvartalsvis."
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    expect(screen.getByTestId('business-context-content')).toBeInTheDocument()
    expect(screen.getByTestId('rich-text-display')).toHaveTextContent(
      /Vi hanterar kemikalier/
    )
  })

  it('renders empty state when content is null', () => {
    render(
      <BusinessContextReadOnly
        content={null}
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    expect(
      screen.getByTestId('business-context-empty-state')
    ).toBeInTheDocument()
    expect(screen.getByText('Ingen beskrivning ännu.')).toBeInTheDocument()
    expect(screen.getByText(/Lägg till i laglistan/)).toBeInTheDocument()
  })

  it('renders empty state when content is an empty string', () => {
    render(
      <BusinessContextReadOnly content="" lawListItemId={LAW_LIST_ITEM_ID} />
    )
    expect(
      screen.getByTestId('business-context-empty-state')
    ).toBeInTheDocument()
  })

  it('renders empty state when content is whitespace-only', () => {
    render(
      <BusinessContextReadOnly
        content={'   \n\t  '}
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    expect(
      screen.getByTestId('business-context-empty-state')
    ).toBeInTheDocument()
  })

  it('edit link has correct href + opens in new tab (populated state)', () => {
    render(
      <BusinessContextReadOnly
        content="Text"
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    const link = screen.getByTestId('business-context-edit-link')
    expect(link).toHaveAttribute(
      'href',
      `/laglistor?document=${LAW_LIST_ITEM_ID}`
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link.textContent).toMatch(/Redigera i laglistan/)
  })

  it('edit link has correct href + opens in new tab (empty state)', () => {
    render(
      <BusinessContextReadOnly
        content={null}
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    const link = screen.getByTestId('business-context-edit-link')
    expect(link).toHaveAttribute(
      'href',
      `/laglistor?document=${LAW_LIST_ITEM_ID}`
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.textContent).toMatch(/Lägg till i laglistan/)
  })

  it('does NOT render an inline editor (read-only contract)', () => {
    render(
      <BusinessContextReadOnly
        content="Body"
        lawListItemId={LAW_LIST_ITEM_ID}
      />
    )
    // No textarea, no Save button — edits only happen via the deep-link.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /spara/i })).toBeNull()
  })

  it('URL-encodes the lawListItemId (defensive against exotic ids)', () => {
    render(
      <BusinessContextReadOnly
        content="Body"
        lawListItemId="id with spaces & ampersand"
      />
    )
    const link = screen.getByTestId('business-context-edit-link')
    expect(link.getAttribute('href')).toBe(
      '/laglistor?document=id%20with%20spaces%20%26%20ampersand'
    )
  })
})

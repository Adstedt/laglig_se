/**
 * Story 25.4 (Epic 25, B.4): component test for <DoneTemplateStep>.
 *
 * Static presentation component — pure render + callback assertions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DoneTemplateStep } from '@/components/features/onboarding-modal/done-template-step'

function renderStep(
  overrides: Partial<React.ComponentProps<typeof DoneTemplateStep>> = {}
) {
  const props = {
    listId: 'list-xyz',
    listName: 'Industrimall — Bygg & Anläggning',
    itemCount: 87,
    onShowList: vi.fn(),
    onKeepExploring: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof DoneTemplateStep>
  render(<DoneTemplateStep {...props} />)
  return props
}

describe('<DoneTemplateStep>', () => {
  it('renders listName + itemCount subheadline (heading owned by DialogTitle)', () => {
    renderStep()

    // Heading owned by <DialogTitle> in parent; body does NOT render an h3.
    expect(
      screen.queryByRole('heading', { name: 'Mallen är aktiverad' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Industrimall — Bygg & Anläggning/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/87 regelverk redo att börja arbetas med/)
    ).toBeInTheDocument()
  })

  it('calls onShowList when primary CTA clicked', () => {
    const onShowList = vi.fn()
    renderStep({ onShowList })

    fireEvent.click(screen.getByRole('button', { name: /Visa min laglista/ }))
    expect(onShowList).toHaveBeenCalledTimes(1)
  })

  // Story 25.6 (B.6) — "Fortsätt utforska" is now enabled.
  it('Fortsätt utforska fires onKeepExploring on click', () => {
    const onKeepExploring = vi.fn()
    renderStep({ onKeepExploring })

    fireEvent.click(screen.getByRole('button', { name: /Fortsätt utforska/i }))

    expect(onKeepExploring).toHaveBeenCalledTimes(1)
  })
})

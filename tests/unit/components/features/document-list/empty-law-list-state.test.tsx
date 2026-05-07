/**
 * Story 24.6 AC 7 + AC 12: EmptyLawListState component tests.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyLawListState } from '@/components/features/document-list/empty-law-list-state'

describe('EmptyLawListState', () => {
  it('renders the empty-state copy mentioning import', () => {
    render(<EmptyLawListState onCreateList={vi.fn()} onOpenImport={vi.fn()} />)

    expect(screen.getByText('Du har inga laglistor än')).toBeInTheDocument()
    expect(
      screen.getByText(/importera en befintlig laglista/i)
    ).toBeInTheDocument()
  })

  it('renders both CTAs — primary "Skapa ny lista" and secondary import link', () => {
    render(<EmptyLawListState onCreateList={vi.fn()} onOpenImport={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: /skapa ny lista/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /eller importera en lista/i })
    ).toBeInTheDocument()
  })

  it('calls onCreateList when the primary CTA is clicked', async () => {
    const user = userEvent.setup()
    const onCreateList = vi.fn()

    render(
      <EmptyLawListState onCreateList={onCreateList} onOpenImport={vi.fn()} />
    )

    await user.click(screen.getByRole('button', { name: /skapa ny lista/i }))

    expect(onCreateList).toHaveBeenCalledOnce()
  })

  it('calls onOpenImport when the secondary import link is clicked', async () => {
    const user = userEvent.setup()
    const onOpenImport = vi.fn()

    render(
      <EmptyLawListState onCreateList={vi.fn()} onOpenImport={onOpenImport} />
    )

    await user.click(
      screen.getByRole('button', { name: /eller importera en lista/i })
    )

    expect(onOpenImport).toHaveBeenCalledOnce()
  })
})

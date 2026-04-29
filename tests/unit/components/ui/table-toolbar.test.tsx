import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TableToolbar } from '@/components/ui/table-toolbar'

describe('TableToolbar', () => {
  it('renders views slot when provided', () => {
    render(<TableToolbar views={<div>tabs-here</div>} />)
    expect(screen.getByText('tabs-here')).toBeInTheDocument()
  })

  it('renders search + filters + rightSlot in right-side group', () => {
    render(
      <TableToolbar
        search={<input placeholder="Sök..." />}
        filters={<div>chips</div>}
        rightSlot={<button>+ Ny</button>}
      />
    )
    expect(screen.getByPlaceholderText('Sök...')).toBeInTheDocument()
    expect(screen.getByText('chips')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Ny' })).toBeInTheDocument()
  })

  it('positions views BEFORE search/filters/rightSlot in DOM order', () => {
    render(
      <TableToolbar
        views={<div data-testid="v">views</div>}
        rightSlot={<div data-testid="r">right</div>}
      />
    )
    const v = screen.getByTestId('v')
    const r = screen.getByTestId('r')
    expect(
      v.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders empty toolbar shell when no slots provided', () => {
    const { container } = render(<TableToolbar />)
    // Shell exists; no children-bearing inner divs
    expect(container.firstElementChild).toBeInTheDocument()
  })

  it('applies justify-between class on the shell', () => {
    const { container } = render(<TableToolbar views={<div />} />)
    expect(container.firstElementChild).toHaveClass('justify-between')
  })
})

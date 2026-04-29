import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Story 22.3 — PageHeader primitive contract.
 */

describe('PageHeader', () => {
  it('renders the title as an <h1>', () => {
    render(<PageHeader title="Mina listor" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Mina listor')
  })

  it('renders subtitle when provided', () => {
    render(<PageHeader title="X" subtitle="Y subtitle" />)
    expect(screen.getByText('Y subtitle')).toBeInTheDocument()
  })

  it('renders breadcrumbs ABOVE the title', () => {
    render(
      <PageHeader
        breadcrumbs={<nav aria-label="Breadcrumb">crumbs</nav>}
        title="X"
      />
    )
    const crumbs = screen.getByText('crumbs')
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(
      crumbs.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders inline badge next to title', () => {
    render(<PageHeader title="Cycle X" badge={<span>Pågående</span>} />)
    expect(screen.getByText('Pågående')).toBeInTheDocument()
  })

  it('renders meta slot below title', () => {
    render(<PageHeader title="X" meta={<div>meta-row</div>} />)
    expect(screen.getByText('meta-row')).toBeInTheDocument()
  })

  it('renders stats with label/value pairs', () => {
    render(
      <PageHeader
        title="X"
        stats={[
          { label: 'Bedömda', value: '4 av 4' },
          { label: 'Signerade', value: '4 av 4' },
        ]}
      />
    )
    expect(screen.getByText('Bedömda')).toBeInTheDocument()
    expect(screen.getAllByText('4 av 4')).toHaveLength(2)
  })

  it('renders primaryAction', () => {
    render(<PageHeader title="X" primaryAction={<button>Skapa</button>} />)
    expect(screen.getByRole('button', { name: 'Skapa' })).toBeInTheDocument()
  })

  it('renders secondaryActions to the LEFT of primaryAction', () => {
    render(
      <PageHeader
        title="X"
        secondaryActions={<button>Mer</button>}
        primaryAction={<button>Skapa</button>}
      />
    )
    const sec = screen.getByRole('button', { name: 'Mer' })
    const pri = screen.getByRole('button', { name: 'Skapa' })
    expect(
      sec.compareDocumentPosition(pri) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('omits empty optional slots cleanly (only title renders when others are absent)', () => {
    const { container } = render(<PageHeader title="Bare" />)
    expect(container.querySelector('h1')).toHaveTextContent('Bare')
  })
})

describe('PageHeader.Meta', () => {
  it('renders dot-separated string items', () => {
    render(<PageHeader.Meta items={['Intern revision', 'Q1 2026']} />)
    expect(screen.getByText('Intern revision')).toBeInTheDocument()
    expect(screen.getByText('Q1 2026')).toBeInTheDocument()
  })

  it('renders icon before label for object items', () => {
    render(
      <PageHeader.Meta
        items={[
          { icon: <span data-testid="meta-icon">★</span>, label: 'Lead' },
        ]}
      />
    )
    expect(screen.getByTestId('meta-icon')).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
  })

  it('renders one separator span per item-after-first', () => {
    render(<PageHeader.Meta items={['a', 'b', 'c']} />)
    // Three dots → two separators
    const separators = document.querySelectorAll('span.text-border')
    expect(separators.length).toBe(2)
  })
})

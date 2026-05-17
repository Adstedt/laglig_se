import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabLaglista } from '@/components/features/onboarding-modal/tutorial-tabs/tab-laglista'

describe('<TabLaglista>', () => {
  it('renders the eyebrow + h3 heading (copy column)', () => {
    render(<TabLaglista />)
    expect(screen.getByText('Översikt')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Den lagstiftning som faktiskt rör er',
      })
    ).toBeInTheDocument()
  })

  it('renders the laglistor table preview (right column)', () => {
    render(<TabLaglista />)
    expect(screen.getByText('Förhandsvisning · /laglistor')).toBeInTheDocument()
    expect(screen.getByText('Miljö')).toBeInTheDocument()
    expect(screen.getByText('Miljöbalk (1998:808)')).toBeInTheDocument()
  })
})

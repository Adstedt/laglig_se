import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabLagandringar } from '@/components/features/onboarding-modal/tutorial-tabs/tab-lagandringar'

describe('<TabLagandringar>', () => {
  it('renders the eyebrow + h3 heading', () => {
    render(<TabLagandringar />)
    expect(screen.getByText('Proaktivitet')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Vi bevakar — ni bedömer påverkan',
      })
    ).toBeInTheDocument()
  })

  it('renders the change card preview with diff + AI-bedömning + CTAs', () => {
    render(<TabLagandringar />)
    expect(
      screen.getByText('Förhandsvisning · /lagandringar')
    ).toBeInTheDocument()
    // "Hög påverkan" appears twice — once as the status pill, once inside the
    // AI-bedömning copy ("Förslag: Hög påverkan för Almåsa"). getAllByText
    // confirms at least one instance renders.
    expect(screen.getAllByText(/Hög påverkan/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AI-bedömning/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Bedöm/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ej relevant' })
    ).toBeInTheDocument()
  })
})

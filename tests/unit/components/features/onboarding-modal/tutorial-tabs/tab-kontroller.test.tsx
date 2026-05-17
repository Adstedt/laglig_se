import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabKontroller } from '@/components/features/onboarding-modal/tutorial-tabs/tab-kontroller'

describe('<TabKontroller>', () => {
  it('renders the eyebrow + h3 heading', () => {
    render(<TabKontroller />)
    expect(screen.getByText('Rytm')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Återkommande lagefterlevnadskontroll',
      })
    ).toBeInTheDocument()
  })

  it('renders the cycle detail preview with progress + signed/unsigned items', () => {
    render(<TabKontroller />)
    expect(
      screen.getByText(/Förhandsvisning · \/laglistor\/kontroller/)
    ).toBeInTheDocument()
    expect(screen.getByText('12 / 24 signerade')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Signera' })).toBeInTheDocument()
  })
})

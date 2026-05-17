import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabUppgifter } from '@/components/features/onboarding-modal/tutorial-tabs/tab-uppgifter'

describe('<TabUppgifter>', () => {
  it('renders the eyebrow + h3 heading', () => {
    render(<TabUppgifter />)
    expect(screen.getByText('Handling')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Från krav till uppgift — utan extra verktyg',
      })
    ).toBeInTheDocument()
  })

  it('renders the kanban preview with all 3 columns + the AI-skapad chip', () => {
    render(<TabUppgifter />)
    expect(screen.getByText('Förhandsvisning · /uppgifter')).toBeInTheDocument()
    expect(screen.getByText('Att göra')).toBeInTheDocument()
    expect(screen.getByText('Pågår')).toBeInTheDocument()
    expect(screen.getByText('Klart')).toBeInTheDocument()
    expect(screen.getByText('AI-skapad')).toBeInTheDocument()
  })
})

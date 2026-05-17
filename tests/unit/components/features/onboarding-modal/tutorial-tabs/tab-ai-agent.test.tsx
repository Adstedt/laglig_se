import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TabAiAgent } from '@/components/features/onboarding-modal/tutorial-tabs/tab-ai-agent'

describe('<TabAiAgent>', () => {
  it('renders the eyebrow + h3 heading (eyebrow is "Agent" not "Översikt" per AC 9)', () => {
    render(<TabAiAgent />)
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Ställ frågor — agenten arbetar med er laglista',
      })
    ).toBeInTheDocument()
  })

  it('renders the chat preview with user bubble, tool-call card, citation chips, and input', () => {
    render(<TabAiAgent />)
    expect(screen.getByText('Förhandsvisning · AI-agent')).toBeInTheDocument()
    expect(
      screen.getByText('Vad krävs för vår egenkontroll av kemikalier?')
    ).toBeInTheDocument()
    expect(screen.getByText(/Verktyg · searchLaws/)).toBeInTheDocument()
    expect(screen.getByText('§ 2:3 MB')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Skapa uppgifter/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skicka' })).toBeInTheDocument()
  })
})

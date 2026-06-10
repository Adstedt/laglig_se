import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FaqAccordion } from '@/components/marketing/sections/faq-accordion'

const items = [
  { question: 'Vad är en laglista?', answer: 'En förteckning över krav.' },
  { question: 'Hur ofta uppdateras den?', answer: 'Löpande vid ändringar.' },
  { question: 'Kan man exportera?', answer: 'Ja, till rapport.' },
]

describe('<FaqAccordion>', () => {
  it('renders every question as an accessible accordion trigger', () => {
    render(<FaqAccordion items={items} />)
    for (const item of items) {
      expect(screen.getByRole('button', { name: item.question })).toBeTruthy()
    }
  })

  it('reveals the answer when a question is expanded', () => {
    render(<FaqAccordion items={items} />)
    const trigger = screen.getByRole('button', {
      name: 'Vad är en laglista?',
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('En förteckning över krav.')).toBeTruthy()
  })

  it('renders the section heading', () => {
    render(<FaqAccordion heading="Frågor om laglistan" items={items} />)
    expect(
      screen.getByRole('heading', { name: 'Frågor om laglistan' })
    ).toBeTruthy()
  })
})

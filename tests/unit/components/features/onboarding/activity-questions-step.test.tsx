import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityQuestionsStep } from '@/app/onboarding/_components/activity-questions-step'
import type { Question } from '@/lib/onboarding/question-selector'

const mockQuestions: Question[] = [
  {
    id: 'personalData',
    label: 'Hanterar ni personuppgifter?',
    description: 'Test description',
    flagKey: 'personalData',
    defaultValue: false,
    inferredFromWebsite: false,
  },
  {
    id: 'food',
    label: 'Hanterar ni livsmedel?',
    description: 'Mat och dryck',
    flagKey: 'food',
    defaultValue: true,
    inferredFromWebsite: true,
  },
  {
    id: 'collective_agreement',
    label: 'Har ni kollektivavtal?',
    description: 'Arbetsrättsliga regler',
    flagKey: 'has_collective_agreement',
    defaultValue: false,
    inferredFromWebsite: false,
  },
]

describe('ActivityQuestionsStep', () => {
  let mockOnNext: ReturnType<typeof vi.fn>
  let mockOnBack: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnNext = vi.fn()
    mockOnBack = vi.fn()
  })

  it('renders all questions with labels and descriptions', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByText('Hanterar ni personuppgifter?')).toBeInTheDocument()
    expect(screen.getByText('Hanterar ni livsmedel?')).toBeInTheDocument()
    expect(screen.getByText('Har ni kollektivavtal?')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('renders header and subtext', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    expect(
      screen.getByText('Hjälp oss förstå er verksamhet bättre')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ju mer vi vet, desto bättre kan vi identifiera relevanta regler.'
      )
    ).toBeInTheDocument()
  })

  it('pre-toggles questions with defaultValue true', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const foodSwitch = screen.getByRole('switch', {
      name: /hanterar ni livsmedel/i,
    })
    expect(foodSwitch).toHaveAttribute('data-state', 'checked')
  })

  it('shows inferred badge for pre-toggled inferred questions', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByText('Baserat på er webbplats')).toBeInTheDocument()
  })

  it('calls onNext with all flags when clicking Nästa', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /nästa/i }))

    expect(mockOnNext).toHaveBeenCalledWith({
      personalData: false,
      food: true,
      has_collective_agreement: false,
    })
  })

  it('calls onNext with all false when clicking Hoppa över', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /hoppa över/i }))

    expect(mockOnNext).toHaveBeenCalledWith({
      personalData: false,
      food: false,
      has_collective_agreement: false,
    })
  })

  it('calls onBack when clicking Tillbaka', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /tillbaka/i }))
    expect(mockOnBack).toHaveBeenCalled()
  })

  it('has aria-describedby linking switches to descriptions', () => {
    render(
      <ActivityQuestionsStep
        questions={mockQuestions}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )

    const personalDataSwitch = screen.getByRole('switch', {
      name: /hanterar ni personuppgifter/i,
    })
    const descId = personalDataSwitch.getAttribute('aria-describedby')
    expect(descId).toBe('question-personalData-desc')
    expect(document.getElementById(descId!)).toHaveTextContent(
      'Test description'
    )
  })
})

import { describe, it, expect } from 'vitest'
import { selectQuestions } from '@/lib/onboarding/question-selector'

describe('selectQuestions', () => {
  it('returns always-ask questions for a generic company', () => {
    const questions = selectQuestions({})

    expect(questions).toHaveLength(2)
    expect(questions.map((q) => q.flagKey)).toEqual([
      'personalData',
      'has_collective_agreement',
    ])
  })

  it('includes food question for restaurant SNI (56xxx)', () => {
    const questions = selectQuestions({ sniCode: '56100' })

    const flagKeys = questions.map((q) => q.flagKey)
    expect(flagKeys).toContain('food')
    expect(flagKeys).toContain('personalData')
    expect(flagKeys).toContain('has_collective_agreement')
  })

  it('includes construction question for SNI 41xxx', () => {
    const questions = selectQuestions({ sniCode: '41200' })

    expect(questions.map((q) => q.flagKey)).toContain('construction')
  })

  it('includes construction question for SNI 43xxx', () => {
    const questions = selectQuestions({ sniCode: '43210' })

    expect(questions.map((q) => q.flagKey)).toContain('construction')
  })

  it('includes chemicals question for SNI 20xxx', () => {
    const questions = selectQuestions({ sniCode: '20110' })

    expect(questions.map((q) => q.flagKey)).toContain('chemicals')
  })

  it('includes publicSector question for SNI 84xxx', () => {
    const questions = selectQuestions({ sniCode: '84110' })

    expect(questions.map((q) => q.flagKey)).toContain('publicSector')
  })

  it('includes minorEmployees question for SNI 85xxx (education)', () => {
    const questions = selectQuestions({ sniCode: '85100' })

    expect(questions.map((q) => q.flagKey)).toContain('minorEmployees')
  })

  it('includes minorEmployees question when employer status is true', () => {
    const questions = selectQuestions({ employerStatus: true })

    expect(questions.map((q) => q.flagKey)).toContain('minorEmployees')
  })

  it('includes minorEmployees question when employeeCount > 0', () => {
    const questions = selectQuestions({ employeeCount: 5 })

    expect(questions.map((q) => q.flagKey)).toContain('minorEmployees')
  })

  it('includes heavyMachinery question for manufacturing SNI (25xxx)', () => {
    const questions = selectQuestions({ sniCode: '25110' })

    expect(questions.map((q) => q.flagKey)).toContain('heavyMachinery')
  })

  it('includes heavyMachinery question for logistics SNI (49xxx)', () => {
    const questions = selectQuestions({ sniCode: '49100' })

    expect(questions.map((q) => q.flagKey)).toContain('heavyMachinery')
  })

  it('enforces max 5 questions even when all triggers match', () => {
    // Construction SNI + employer + inferred flags for everything
    const questions = selectQuestions({
      sniCode: '41200',
      employerStatus: true,
      inferredFlags: {
        chemicals: true,
        food: true,
        personalData: true,
        publicSector: true,
        heavyMachinery: true,
        minorEmployees: true,
        internationalOperations: true,
        construction: true,
      },
    })

    expect(questions.length).toBeLessThanOrEqual(5)
  })

  it('pre-toggles questions from inferred flags', () => {
    const questions = selectQuestions({
      inferredFlags: { food: true, chemicals: true },
    })

    const foodQ = questions.find((q) => q.flagKey === 'food')
    const chemQ = questions.find((q) => q.flagKey === 'chemicals')

    expect(foodQ).toBeDefined()
    expect(foodQ!.defaultValue).toBe(true)
    expect(foodQ!.inferredFromWebsite).toBe(true)

    expect(chemQ).toBeDefined()
    expect(chemQ!.defaultValue).toBe(true)
    expect(chemQ!.inferredFromWebsite).toBe(true)
  })

  it('includes inferred-flag questions even without SNI match', () => {
    // IT company (62xxx) but with inferred food flag
    const questions = selectQuestions({
      sniCode: '62010',
      inferredFlags: { food: true },
    })

    expect(questions.map((q) => q.flagKey)).toContain('food')
  })

  it('does not pre-toggle questions without inferred flags', () => {
    const questions = selectQuestions({ sniCode: '56100' })

    const foodQ = questions.find((q) => q.flagKey === 'food')
    expect(foodQ!.defaultValue).toBe(false)
    expect(foodQ!.inferredFromWebsite).toBe(false)
  })

  it('always-ask questions come first in priority', () => {
    const questions = selectQuestions({
      sniCode: '41200',
      inferredFlags: { food: true },
    })

    expect(questions[0]!.flagKey).toBe('personalData')
    expect(questions[1]!.flagKey).toBe('has_collective_agreement')
  })

  it('handles SNI codes with hyphens or spaces', () => {
    const questions = selectQuestions({ sniCode: '56-100' })
    expect(questions.map((q) => q.flagKey)).toContain('food')
  })
})

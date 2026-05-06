/**
 * Story 16.1: Signup page bridge tests
 * Tests that query params are stored to OnboardingStore and badge renders correctly.
 */

import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

// Mock next/navigation
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// Mock OnboardingStore
const mockSaveOnboardingData = vi.fn()
const mockGetOnboardingData = vi.fn()
const mockParseFlags = vi.fn()
const mockParsePickedTier = vi.fn()
vi.mock('@/lib/onboarding/onboarding-store', () => ({
  saveOnboardingData: (...args: unknown[]) => mockSaveOnboardingData(...args),
  getOnboardingData: () => mockGetOnboardingData(),
  parseFlags: (...args: unknown[]) => mockParseFlags(...args),
  parsePickedTier: (...args: unknown[]) => mockParsePickedTier(...args),
}))

// Mock auth action
vi.mock('@/app/actions/auth', () => ({
  signupAction: vi.fn(),
}))

// Mock validation
vi.mock('@/lib/validation/auth', () => ({
  SignupSchema: {
    safeParse: vi.fn(() => ({ success: true })),
  },
}))

import { SignupForm } from '@/app/(auth)/signup/_signup-form'

describe('Signup Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockGetOnboardingData.mockReturnValue(null)
    mockParseFlags.mockImplementation((flags: string | null) => {
      if (!flags) return undefined
      const entries = flags
        .split(',')
        .map((f: string) => f.trim())
        .filter((f: string) => f.length > 0)
      if (entries.length === 0) return undefined
      return Object.fromEntries(entries.map((f: string) => [f, true]))
    })
  })

  // 5.10: query params stored to localStorage on mount
  it('saves query params to OnboardingStore on mount', () => {
    mockSearchParams = new URLSearchParams(
      'org=556677-8899&url=https://test.se&flags=food,chemicals&summary=A+food+company'
    )
    mockGetOnboardingData.mockReturnValue({ orgNumber: '556677-8899' })

    render(<SignupForm />)

    expect(mockSaveOnboardingData).toHaveBeenCalledWith({
      orgNumber: '556677-8899',
      websiteUrl: 'https://test.se',
      inferredFlags: { food: true, chemicals: true },
      companySummary: 'A food company',
    })
  })

  it('does not save when org param is missing', () => {
    mockSearchParams = new URLSearchParams('url=https://test.se')

    render(<SignupForm />)

    expect(mockSaveOnboardingData).not.toHaveBeenCalled()
  })

  // 5.11: renders badge when OnboardingStore has data
  it('renders confirmation badge when stored data exists', () => {
    mockGetOnboardingData.mockReturnValue({ orgNumber: '556677-8899' })

    render(<SignupForm />)

    expect(
      screen.getByText(/Vi har din företagsinformation redo/)
    ).toBeInTheDocument()
  })

  it('does not render badge when no stored data', () => {
    mockGetOnboardingData.mockReturnValue(null)

    render(<SignupForm />)

    expect(
      screen.queryByText(/Vi har din företagsinformation redo/)
    ).not.toBeInTheDocument()
  })
})

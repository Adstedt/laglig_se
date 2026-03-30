/**
 * Story 16.1: Onboarding pre-fill and cleanup tests
 * Tests that stored data populates form fields and cleanup works after workspace creation.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

// Track setValue calls
const mockSetValue = vi.fn()
const mockWatch = vi.fn()
const mockRegister = vi.fn(() => ({}))
const mockHandleSubmit = vi.fn(
  (fn: (..._args: unknown[]) => void) => (e?: Event) => {
    e?.preventDefault?.()
    return fn({
      companyName: 'Test AB',
      orgNumber: '556677-8899',
    })
  }
)

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: mockRegister,
    handleSubmit: mockHandleSubmit,
    setValue: mockSetValue,
    watch: mockWatch,
    formState: { errors: {} },
  }),
}))

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}))

// Mock useCompanyLookup — controls when BolagsAPI "completes"
let mockLookupData: Record<string, unknown> | null = null
vi.mock('@/lib/hooks/use-company-lookup', () => ({
  useCompanyLookup: () => ({
    data: mockLookupData,
    isLoading: false,
    error: null,
    isAutoFilled: !!mockLookupData,
  }),
}))

// Mock OnboardingStore
const mockGetOnboardingData = vi.fn()
const mockClearOnboardingData = vi.fn()
vi.mock('@/lib/onboarding/onboarding-store', () => ({
  getOnboardingData: () => mockGetOnboardingData(),
  clearOnboardingData: () => mockClearOnboardingData(),
}))

// Mock workspace validation
vi.mock('@/lib/validation/workspace', () => ({
  WorkspaceOnboardingSchema: {
    _def: {},
    parse: vi.fn(),
    safeParse: vi.fn(() => ({ success: true })),
  },
  LEGAL_FORM_OPTIONS: [
    { value: 'AB', label: 'Aktiebolag' },
    { value: 'EF', label: 'Enskild firma' },
  ],
  LEGAL_FORM_LABELS: {
    AB: 'Aktiebolag',
    EF: 'Enskild firma',
  } as Record<string, string>,
}))

// Mock workspace action
const mockCreateWorkspace = vi.fn()
vi.mock('@/app/actions/workspace', () => ({
  createWorkspace: (...args: unknown[]) => mockCreateWorkspace(...args),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  getSafeRedirectUrl: (url?: string) => url ?? '/dashboard',
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { CompanyInfoStep } from '@/app/onboarding/_components/company-info-step'
import { OnboardingWizard } from '@/app/onboarding/_components/onboarding-wizard'

describe('CompanyInfoStep pre-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLookupData = null
    mockWatch.mockReturnValue('')
  })

  // 5.12: stored data populates form fields via setValue with correct field names
  it('pre-fills form fields from OnboardingStore with correct field names', () => {
    mockGetOnboardingData.mockReturnValue({
      orgNumber: '556677-8899',
      companyName: 'Test AB',
      legalForm: 'AB',
      streetAddress: 'Storgatan 1',
      postalCode: '111 22',
      city: 'Stockholm',
      sniCode: '62010',
      industryLabel: 'Dataprogrammering',
      websiteUrl: 'https://test.se',
    })

    render(<CompanyInfoStep defaultValues={{}} onNext={vi.fn()} />)

    // Verify correct field names (streetAddress, postalCode — NOT gatuadress, postnummer)
    expect(mockSetValue).toHaveBeenCalledWith('orgNumber', '556677-8899')
    expect(mockSetValue).toHaveBeenCalledWith('companyName', 'Test AB')
    expect(mockSetValue).toHaveBeenCalledWith('streetAddress', 'Storgatan 1')
    expect(mockSetValue).toHaveBeenCalledWith('postalCode', '111 22')
    expect(mockSetValue).toHaveBeenCalledWith('city', 'Stockholm')
    expect(mockSetValue).toHaveBeenCalledWith('sniCode', '62010')
    expect(mockSetValue).toHaveBeenCalledWith(
      'industryLabel',
      'Dataprogrammering'
    )
    expect(mockSetValue).toHaveBeenCalledWith('websiteUrl', 'https://test.se')
    expect(mockSetValue).toHaveBeenCalledWith('legalForm', 'AB', {
      shouldValidate: true,
    })
  })

  it('does not call setValue when no stored data exists', () => {
    mockGetOnboardingData.mockReturnValue(null)

    render(<CompanyInfoStep defaultValues={{}} onNext={vi.fn()} />)

    // setValue should not be called for pre-fill fields (may be called by other effects)
    expect(mockSetValue).not.toHaveBeenCalledWith(
      'orgNumber',
      expect.any(String)
    )
  })

  // 5.13: companySummary overrides businessDescription AFTER BolagsAPI auto-fill completes
  it('sets businessDescription from companySummary after BolagsAPI lookup completes', async () => {
    mockGetOnboardingData.mockReturnValue({
      orgNumber: '556677-8899',
      companySummary: 'A great food company',
    })

    // Start with no lookup data
    const { rerender } = render(
      <CompanyInfoStep defaultValues={{}} onNext={vi.fn()} />
    )

    // Simulate BolagsAPI lookup completing
    mockLookupData = {
      profile: {
        company_name: 'Test AB',
        business_description: 'Legal boilerplate text',
      },
      address: { street: 'Storgatan 1' },
    }

    rerender(<CompanyInfoStep defaultValues={{}} onNext={vi.fn()} />)

    await waitFor(() => {
      // The companySummary should override the BolagsAPI businessDescription
      expect(mockSetValue).toHaveBeenCalledWith(
        'businessDescription',
        'A great food company'
      )
    })
  })
})

describe('OnboardingWizard cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOnboardingData.mockReturnValue(null)
    mockWatch.mockReturnValue('')
  })

  // 5.14: localStorage cleared after successful workspace creation
  it('calls clearOnboardingData after successful createWorkspace', async () => {
    mockCreateWorkspace.mockResolvedValue({ success: true })

    render(<OnboardingWizard />)

    // Step 1: Click "Nästa" on CompanyInfoStep to advance to ConfirmStep
    const nextButton = screen.getByRole('button', { name: /nästa/i })
    fireEvent.click(nextButton)

    // Step 2: Now on ConfirmStep — click "Skapa workspace" to trigger submit
    const submitButton = await screen.findByRole('button', {
      name: /skapa workspace/i,
    })
    fireEvent.click(submitButton)

    // Step 3: Verify cleanup was called after successful workspace creation
    await waitFor(() => {
      expect(mockCreateWorkspace).toHaveBeenCalled()
      expect(mockClearOnboardingData).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { AssessmentDetail } from '@/components/features/ai-chat/details/assessment-detail'
import type { AssessmentDetailData } from '@/lib/ai/chat-detail-context'

// Mock server actions
const mockGetAssessment = vi.fn()
const mockCreateOrUpdateAssessment = vi.fn()
vi.mock('@/app/actions/change-assessment', () => ({
  getAssessment: (...args: unknown[]) => mockGetAssessment(...args),
  createOrUpdateAssessment: (...args: unknown[]) =>
    mockCreateOrUpdateAssessment(...args),
}))

const mockAssessmentData: AssessmentDetailData = {
  changeEventId: 'change-1',
  lawListItemId: 'item-1',
  amendmentSfs: 'SFS 2026:145',
  changeType: 'AMENDMENT',
  affectedSections: ['Kap 3 § 2', 'Kap 3 § 4'],
  // Computed ~90 days ahead of the run so the "Träder i kraft" (future) badge
  // assertion below is stable forever. A hardcoded date here decayed into the
  // past (was 2026-07-01) and flipped the badge to "I kraft sedan …", failing
  // CI daily from 2026-07-02 onward.
  effectiveDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  existingAssessment: {
    status: 'REVIEWED',
    impactLevel: 'MEDIUM',
    aiAnalysis: 'Denna ändring påverkar kemikaliehanteringen.',
    userNotes: null,
  },
  documentTitle: 'Arbetsmiljölagen',
  documentNumber: 'SFS 1977:1160',
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('AssessmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAssessment.mockResolvedValue({ success: false })
  })

  it('renders guiding intro text', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(
      screen.getByText(/Granska ändringen och dokumentera din bedömning/)
    ).toBeDefined()
  })

  it('renders change event context header with Swedish labels', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(screen.getByText('Ändring')).toBeDefined()
    expect(screen.getByText('SFS 2026:145')).toBeDefined()
  })

  it('renders affected sections', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(screen.getByText('Kap 3 § 2, Kap 3 § 4')).toBeDefined()
  })

  it('renders AI analysis when available', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(screen.getByText('AI-analys')).toBeDefined()
    expect(
      screen.getByText('Denna ändring påverkar kemikaliehanteringen.')
    ).toBeDefined()
  })

  it('renders assessment form with status and impact selectors', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(screen.getByText('Din bedömning')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
    expect(screen.getByText('Påverkan')).toBeDefined()
    expect(screen.getByText('Spara bedömning')).toBeDefined()
  })

  it('shows effective date badge', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    // The effective date is in the future, so it should show "Träder i kraft om X dagar"
    const badges = screen.getAllByText(/Träder i kraft/)
    expect(badges.length).toBeGreaterThan(0)
  })

  it('pre-fills from the agent recommendation and marks it as AI-suggested', async () => {
    const data: AssessmentDetailData = {
      ...mockAssessmentData,
      existingAssessment: null,
      recommendation: {
        status: 'NOT_APPLICABLE',
        impactLevel: 'NONE',
        notes: 'Berör inte er verksamhet.',
      },
    }

    render(
      <TestWrapper>
        <AssessmentDetail data={data} />
      </TestWrapper>
    )

    // The AI-suggestion hint is shown...
    await waitFor(() => {
      expect(screen.getByText(/Förifyllt av AI/)).toBeDefined()
    })
    // ...and the notes field is pre-filled from the recommendation.
    expect(
      (screen.getByPlaceholderText(/Anteckningar/) as HTMLTextAreaElement).value
    ).toBe('Berör inte er verksamhet.')
  })

  it('does not mark as AI-suggested when a saved assessment exists', () => {
    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    expect(screen.queryByText(/Förifyllt av AI/)).toBeNull()
  })

  it('saves assessment on confirm', async () => {
    mockCreateOrUpdateAssessment.mockResolvedValue({
      success: true,
      data: {
        id: 'assessment-1',
        changeEventId: 'change-1',
        lawListItemId: 'item-1',
        status: 'REVIEWED',
        impactLevel: 'MEDIUM',
        aiAnalysis: null,
        aiRecommendations: null,
        userNotes: null,
        assessedBy: 'user-1',
        assessedAt: new Date(),
      },
    })

    render(
      <TestWrapper>
        <AssessmentDetail data={mockAssessmentData} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Spara bedömning'))

    await waitFor(() => {
      expect(mockCreateOrUpdateAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          changeEventId: 'change-1',
          lawListItemId: 'item-1',
        })
      )
    })
  })
})

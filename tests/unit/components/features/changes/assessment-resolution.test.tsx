import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AssessmentResolution } from '@/components/features/changes/assessment-resolution'

// Mock server actions used by useAssessmentForm
const mockGetAssessment = vi.fn()
const mockCreateOrUpdateAssessment = vi.fn()
vi.mock('@/app/actions/change-assessment', () => ({
  getAssessment: (...args: unknown[]) => mockGetAssessment(...args),
  createOrUpdateAssessment: (...args: unknown[]) =>
    mockCreateOrUpdateAssessment(...args),
}))

describe('AssessmentResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAssessment.mockResolvedValue({ success: false })
  })

  it('renders the editing form with no recommendation', async () => {
    render(<AssessmentResolution changeEventId="ce-1" lawListItemId="lli-1" />)
    expect(screen.getByText('Din bedömning')).toBeDefined()
    expect(screen.getByText('Spara bedömning')).toBeDefined()
    expect(screen.queryByText(/Förifyllt av AI/)).toBeNull()
  })

  it('pre-fills notes and shows the AI hint from a recommendation', async () => {
    render(
      <AssessmentResolution
        changeEventId="ce-1"
        lawListItemId="lli-1"
        recommendation={{
          status: 'NOT_APPLICABLE',
          impactLevel: 'NONE',
          notes: 'Berör inte er verksamhet.',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Förifyllt av AI/)).toBeDefined()
    })
    expect(
      (screen.getByPlaceholderText(/Anteckningar/) as HTMLTextAreaElement).value
    ).toBe('Berör inte er verksamhet.')
  })

  it('shows the saved completion summary (not the AI hint) when an assessment exists', async () => {
    mockGetAssessment.mockResolvedValue({
      success: true,
      data: {
        id: 'ca-1',
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        status: 'NOT_APPLICABLE',
        impactLevel: 'NONE',
        aiAnalysis: null,
        aiRecommendations: null,
        userNotes: null,
        assessedBy: 'user-1',
        assessedAt: new Date(),
      },
    })

    render(
      <AssessmentResolution
        changeEventId="ce-1"
        lawListItemId="lli-1"
        recommendation={{ status: 'REVIEWED', impactLevel: 'LOW' }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Bedömning sparad')).toBeDefined()
    })
    expect(screen.queryByText(/Förifyllt av AI/)).toBeNull()
  })
})

/**
 * Story 14.24 QA (Quinn): tests for PendingAgentApprovalBanner.
 * Added during review — the AC-specified banner tests ("mount with mocked SWR
 * per state; click paths for Slutför/Avvisa") were missing from the dev submission.
 * Covers the IN_EDITOR render guard + the finalize/reject click paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockUseSWR, mockPush, mockFinalize, mockReject, mockMutate } =
  vi.hoisted(() => ({
    mockUseSWR: vi.fn(),
    mockPush: vi.fn(),
    mockFinalize: vi.fn(),
    mockReject: vi.fn(),
    mockMutate: vi.fn(),
  }))

vi.mock('swr', () => ({ default: mockUseSWR }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/app/actions/pending-agent-actions', () => ({
  getPendingAgentAction: vi.fn(),
  finalizeDraftFromEditor: mockFinalize,
  rejectDraftFromEditor: mockReject,
}))

import { PendingAgentApprovalBanner } from '@/components/features/documents/pending-agent-approval-banner'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSWR.mockReturnValue({
    data: { status: 'IN_EDITOR' },
    mutate: mockMutate,
  })
})

describe('PendingAgentApprovalBanner', () => {
  it('renders nothing when the pending row is not IN_EDITOR (AC 15 unmount guard)', () => {
    mockUseSWR.mockReturnValue({
      data: { status: 'APPROVED' },
      mutate: mockMutate,
    })
    const { container } = render(
      <PendingAgentApprovalBanner pendingActionId="pa_1" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner with finalize + reject controls on IN_EDITOR', () => {
    render(<PendingAgentApprovalBanner pendingActionId="pa_1" />)
    expect(screen.getByText(/Väntar på godkännande/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Slutför godkännande/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avvisa/ })).toBeInTheDocument()
  })

  it('"Slutför godkännande" finalizes then revalidates (SWR-driven unmount)', async () => {
    mockFinalize.mockResolvedValue({
      success: true,
      data: { documentId: 'doc_1' },
    })
    render(<PendingAgentApprovalBanner pendingActionId="pa_1" />)
    fireEvent.click(screen.getByRole('button', { name: /Slutför godkännande/ }))
    await waitFor(() => expect(mockFinalize).toHaveBeenCalledWith('pa_1'))
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
  })

  it('"Avvisa" rejects and navigates back to the document list', async () => {
    mockReject.mockResolvedValue({ success: true })
    render(<PendingAgentApprovalBanner pendingActionId="pa_1" />)
    fireEvent.click(screen.getByRole('button', { name: /Avvisa/ }))
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('pa_1'))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/workspace/styrdokument')
    )
  })
})

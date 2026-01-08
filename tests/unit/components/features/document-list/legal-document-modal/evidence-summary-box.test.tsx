/**
 * Story 6.3: Evidence Summary Box Unit Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvidenceSummaryBox } from '@/components/features/document-list/legal-document-modal/evidence-summary-box'
import type { EvidenceSummary } from '@/app/actions/legal-document-modal'

describe('EvidenceSummaryBox', () => {
  const mockOnViewAll = vi.fn()

  const defaultProps = {
    evidence: null as EvidenceSummary[] | null,
    onViewAll: mockOnViewAll,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when evidence is null', () => {
    render(<EvidenceSummaryBox {...defaultProps} />)

    expect(screen.getByText('Bevis')).toBeInTheDocument()
    expect(screen.getByText('Inga bevis bifogade')).toBeInTheDocument()
  })

  it('renders empty state when evidence array is empty', () => {
    render(<EvidenceSummaryBox {...defaultProps} evidence={[]} />)

    expect(screen.getByText('Inga bevis bifogade')).toBeInTheDocument()
  })

  it('displays file count for single file', () => {
    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
        ]}
      />
    )

    expect(screen.getByText('1 fil bifogade')).toBeInTheDocument()
  })

  it('displays file count for multiple files', () => {
    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'document1.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '2',
            filename: 'document2.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '3',
            filename: 'image.png',
            mimeType: 'image/png',
            createdAt: new Date(),
          },
        ]}
      />
    )

    expect(screen.getByText('3 filer bifogade')).toBeInTheDocument()
  })

  it('renders thumbnail grid with filenames', () => {
    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'contract.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '2',
            filename: 'photo.jpg',
            mimeType: 'image/jpeg',
            createdAt: new Date(),
          },
        ]}
      />
    )

    expect(screen.getByText('contract.pdf')).toBeInTheDocument()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })

  it('calls onViewAll when clicking on a file thumbnail', async () => {
    const user = userEvent.setup()

    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
        ]}
      />
    )

    await user.click(screen.getByText('document.pdf'))

    expect(mockOnViewAll).toHaveBeenCalled()
  })

  it('shows "View all" button when more than 4 files', () => {
    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'file1.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '2',
            filename: 'file2.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '3',
            filename: 'file3.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '4',
            filename: 'file4.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '5',
            filename: 'file5.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
        ]}
      />
    )

    expect(
      screen.getByRole('button', { name: /visa alla 5 filer/i })
    ).toBeInTheDocument()
  })

  it('only renders max 4 thumbnails', () => {
    render(
      <EvidenceSummaryBox
        {...defaultProps}
        evidence={[
          {
            id: '1',
            filename: 'file1.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '2',
            filename: 'file2.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '3',
            filename: 'file3.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '4',
            filename: 'file4.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '5',
            filename: 'file5.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
          {
            id: '6',
            filename: 'file6.pdf',
            mimeType: 'application/pdf',
            createdAt: new Date(),
          },
        ]}
      />
    )

    // Should show first 4 files
    expect(screen.getByText('file1.pdf')).toBeInTheDocument()
    expect(screen.getByText('file4.pdf')).toBeInTheDocument()
    // Should not show 5th and 6th files in thumbnails
    expect(screen.queryByText('file5.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText('file6.pdf')).not.toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentDetail } from '@/components/features/ai-chat/details/document-detail'
import type { DocumentDetailData } from '@/lib/ai/chat-detail-context'

const mockDoc: DocumentDetailData = {
  id: 'doc-1',
  title: 'Arbetsmiljölagen',
  document_number: 'SFS 1977:1160',
  slug: 'arbetsmiljolagen-1977-1160',
  content_type: 'LAG',
  summary: 'Lagen reglerar arbetsgivarens ansvar för arbetsmiljön.',
  lawListItem: {
    id: 'item-1',
    complianceStatus: 'PAGAENDE',
    group: { id: 'g-1', name: 'Arbetsmiljö' },
  },
}

describe('DocumentDetail', () => {
  it('renders document info', () => {
    render(<DocumentDetail data={mockDoc} />)

    expect(screen.getByText('Arbetsmiljölagen')).toBeDefined()
    expect(screen.getByText('SFS 1977:1160')).toBeDefined()
    expect(screen.getByText('Lag')).toBeDefined()
    expect(
      screen.getByText('Lagen reglerar arbetsgivarens ansvar för arbetsmiljön.')
    ).toBeDefined()
  })

  it('shows law list status when document is in user list', () => {
    render(<DocumentDetail data={mockDoc} />)

    expect(screen.getByText('I din laglista')).toBeDefined()
    expect(screen.getByText('Pågående')).toBeDefined()
    expect(screen.getByText('Arbetsmiljö')).toBeDefined()
  })

  it('does not show law list section when not in list', () => {
    const docWithoutList = { ...mockDoc, lawListItem: undefined }
    render(<DocumentDetail data={docWithoutList} />)

    expect(screen.queryByText('I din laglista')).toBeNull()
  })

  it('renders navigation link', () => {
    render(<DocumentDetail data={mockDoc} />)
    expect(screen.getByText('Visa dokument')).toBeDefined()
  })
})

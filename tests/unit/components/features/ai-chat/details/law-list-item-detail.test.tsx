import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { LawListItemDetail } from '@/components/features/ai-chat/details/law-list-item-detail'
import type { LawListItemDetailData } from '@/lib/ai/chat-detail-context'

const mockUpdateListItem = vi.fn()
vi.mock('@/app/actions/document-list', () => ({
  updateListItem: (...args: unknown[]) => mockUpdateListItem(...args),
}))

const mockItem: LawListItemDetailData = {
  id: 'item-1',
  documentTitle: 'Arbetsmiljölagen',
  documentNumber: 'SFS 1977:1160',
  slug: 'arbetsmiljolagen-1977-1160',
  complianceStatus: 'PAGAENDE',
  group: { id: 'g-1', name: 'Arbetsmiljö' },
  businessContext: 'Gäller för samtliga anställda i produktionen.',
  lastChangeAcknowledgedAt: new Date('2026-03-15'),
  lawListId: 'list-1',
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('LawListItemDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders document info', () => {
    render(
      <TestWrapper>
        <LawListItemDetail data={mockItem} />
      </TestWrapper>
    )

    expect(screen.getByText('Arbetsmiljölagen')).toBeDefined()
    expect(screen.getByText('SFS 1977:1160')).toBeDefined()
  })

  it('renders compliance status selector', () => {
    render(
      <TestWrapper>
        <LawListItemDetail data={mockItem} />
      </TestWrapper>
    )

    expect(screen.getByText('Efterlevnadsstatus')).toBeDefined()
  })

  it('renders group name', () => {
    render(
      <TestWrapper>
        <LawListItemDetail data={mockItem} />
      </TestWrapper>
    )

    expect(screen.getByText('Arbetsmiljö')).toBeDefined()
  })

  it('renders business context', () => {
    render(
      <TestWrapper>
        <LawListItemDetail data={mockItem} />
      </TestWrapper>
    )

    expect(
      screen.getByText('Gäller för samtliga anställda i produktionen.')
    ).toBeDefined()
  })

  it('renders navigation link with correct params', () => {
    render(
      <TestWrapper>
        <LawListItemDetail data={mockItem} />
      </TestWrapper>
    )

    const link = screen.getByText('Visa i laglistan')
    expect(link).toBeDefined()
  })
})

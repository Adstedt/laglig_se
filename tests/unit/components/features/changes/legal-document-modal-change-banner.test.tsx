/**
 * Story 8.1 Task 7: LegalDocumentModal change banner tests
 *
 * Tests the actual LegalDocumentModal component's pending changes banner.
 * Mocks heavy child components and the SWR hook to keep tests fast and focused.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalDocumentModal } from '@/components/features/document-list/legal-document-modal'
import type { InitialListItemData } from '@/lib/hooks/use-list-item-details'

// ============================================================================
// Mocks
// ============================================================================

// Mock the SWR hook — return a minimal non-loading state with a list item
vi.mock('@/lib/hooks/use-list-item-details', () => ({
  useListItemDetails: () => ({
    listItem: {
      id: 'lli-1',
      legalDocument: {
        id: 'doc-1',
        title: 'Testlagen',
        documentNumber: 'SFS 2024:1',
        slug: 'testlagen',
        contentType: 'SFS',
        summary: null,
        htmlContent: null,
        effectiveDate: null,
        sourceUrl: null,
        status: 'ACTIVE',
      },
      lawList: { id: 'list-1', name: 'Testlista' },
      complianceStatus: 'EJ_BEDOMD',
      priority: 'MEDIUM',
      position: 0,
      category: null,
      addedAt: new Date(),
      dueDate: null,
      responsibleUser: null,
      businessContext: null,
      complianceActions: null,
      complianceActionsUpdatedAt: null,
      complianceActionsUpdatedBy: null,
    },
    taskProgress: null,
    evidence: null,
    workspaceMembers: [],
    isLoading: false,
    isLoadingContent: false,
    error: null,
    mutate: vi.fn(),
    mutateTaskProgress: vi.fn(),
    optimisticTaskUpdate: vi.fn(),
  }),
}))

// Mock heavy child components to keep tests focused on the banner
vi.mock(
  '@/components/features/document-list/legal-document-modal/modal-header',
  () => ({
    ModalHeader: () => <div data-testid="modal-header">Header</div>,
  })
)
vi.mock(
  '@/components/features/document-list/legal-document-modal/left-panel',
  () => ({
    LeftPanel: () => <div data-testid="left-panel">Left</div>,
  })
)
vi.mock(
  '@/components/features/document-list/legal-document-modal/right-panel',
  () => ({
    RightPanel: () => <div data-testid="right-panel">Right</div>,
  })
)
vi.mock(
  '@/components/features/document-list/legal-document-modal/ai-chat-panel',
  () => ({
    AiChatPanel: () => <div data-testid="ai-chat-panel">AI</div>,
  })
)
vi.mock(
  '@/components/features/document-list/legal-document-modal/modal-skeleton',
  () => ({
    ModalSkeleton: () => <div data-testid="modal-skeleton">Skeleton</div>,
  })
)

// ============================================================================
// Helpers
// ============================================================================

function makeInitialData(
  overrides: Partial<InitialListItemData> = {}
): InitialListItemData {
  return {
    id: 'lli-1',
    position: 0,
    complianceStatus: 'EJ_BEDOMD',
    priority: 'MEDIUM',
    category: null,
    addedAt: new Date(),
    dueDate: null,
    responsibleUser: null,
    document: {
      id: 'doc-1',
      title: 'Testlagen',
      documentNumber: 'SFS 2024:1',
      contentType: 'SFS',
      slug: 'testlagen',
      summary: null,
      effectiveDate: null,
    },
    lawList: { id: 'list-1', name: 'Testlista' },
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('LegalDocumentModal Change Banner (Story 8.1)', () => {
  it('renders banner when pendingChangeCount > 0 (singular)', () => {
    render(
      <LegalDocumentModal
        listItemId="lli-1"
        onClose={vi.fn()}
        initialData={makeInitialData({ pendingChangeCount: 1 })}
      />
    )

    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === 'Denna lag har 1 oläst ändring'
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Visa ändringar')).toBeInTheDocument()
  })

  it('renders banner with plural form for multiple changes', () => {
    render(
      <LegalDocumentModal
        listItemId="lli-1"
        onClose={vi.fn()}
        initialData={makeInitialData({ pendingChangeCount: 5 })}
      />
    )

    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === 'Denna lag har 5 olästa ändringar'
      })
    ).toBeInTheDocument()
  })

  it('does not render banner when pendingChangeCount is 0', () => {
    render(
      <LegalDocumentModal
        listItemId="lli-1"
        onClose={vi.fn()}
        initialData={makeInitialData({ pendingChangeCount: 0 })}
      />
    )

    expect(screen.queryByText('Visa ändringar')).not.toBeInTheDocument()
  })

  it('does not render banner when pendingChangeCount is undefined', () => {
    render(
      <LegalDocumentModal
        listItemId="lli-1"
        onClose={vi.fn()}
        initialData={makeInitialData()}
      />
    )

    expect(screen.queryByText('Visa ändringar')).not.toBeInTheDocument()
  })

  it('banner link points to changes tab filtered by document', () => {
    render(
      <LegalDocumentModal
        listItemId="lli-1"
        onClose={vi.fn()}
        initialData={makeInitialData({ pendingChangeCount: 2 })}
      />
    )

    const link = screen.getByText('Visa ändringar')
    expect(link.closest('a')).toHaveAttribute(
      'href',
      '/laglistor?tab=changes&document=doc-1'
    )
  })

  it('does not render banner when modal is closed (no listItemId)', () => {
    render(
      <LegalDocumentModal
        listItemId={null}
        onClose={vi.fn()}
        initialData={makeInitialData({ pendingChangeCount: 3 })}
      />
    )

    expect(screen.queryByText('Visa ändringar')).not.toBeInTheDocument()
  })
})

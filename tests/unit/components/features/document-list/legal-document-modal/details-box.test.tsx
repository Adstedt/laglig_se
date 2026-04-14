/**
 * Story 17.18: DetailsBox — "Senaste ändring" row + Ny badge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailsBox } from '@/components/features/document-list/legal-document-modal/details-box'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'

vi.mock('@/app/actions/legal-document-modal', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/actions/legal-document-modal')
  >('@/app/actions/legal-document-modal')
  return {
    ...actual,
    updateListItemComplianceStatus: vi.fn(),
    updateListItemResponsible: vi.fn(),
    updateListItemPriority: vi.fn(),
  }
})

const BASE_LIST_ITEM: ListItemDetails = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  position: 1,
  complianceStatus: 'EJ_PABORJAD',
  priority: 'MEDIUM',
  businessContext: null,
  aiCommentary: null,
  category: null,
  addedAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  dueDate: null,
  complianceActions: null,
  complianceActionsUpdatedAt: null,
  complianceActionsUpdatedBy: null,
  legalDocument: {
    id: 'doc-1',
    title: 'Test Law',
    documentNumber: 'SFS 2009:946',
    htmlContent: null,
    summary: null,
    slug: 'sfs-2009-946',
    status: 'ACTIVE',
    sourceUrl: null,
    contentType: 'sfs',
    effectiveDate: null,
  },
  lawList: { id: 'list-1', name: 'Test list' },
  responsibleUser: null,
  latestAmendment: null,
  lastChangeAcknowledgedAt: null,
}

function renderDetailsBox(overrides: Partial<ListItemDetails> = {}) {
  const listItem = { ...BASE_LIST_ITEM, ...overrides }
  return render(
    <DetailsBox listItem={listItem} workspaceMembers={[]} onUpdate={vi.fn()} />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DetailsBox — Senaste ändring row (Story 17.18)', () => {
  it('renders no "Senaste ändring" row when latestAmendment is null', () => {
    renderDetailsBox({ latestAmendment: null })
    expect(screen.queryByText('Senaste ändring')).not.toBeInTheDocument()
  })

  it('renders the SFS number as an external link when originalUrl is non-null', () => {
    renderDetailsBox({
      latestAmendment: {
        sfsNumber: 'SFS 2025:1',
        changedAt: new Date('2025-01-09T00:00:00Z'),
        originalUrl:
          'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-01/SFS2025-1.pdf',
      },
      lastChangeAcknowledgedAt: new Date('2026-06-01T00:00:00Z'), // newer than amendment → no Ny
    })
    expect(screen.getByText('Senaste ändring')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /SFS 2025:1/ })
    expect(link).toHaveAttribute(
      'href',
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2025-01/SFS2025-1.pdf'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the SFS number as plain text (no anchor) when originalUrl is null', () => {
    renderDetailsBox({
      latestAmendment: {
        sfsNumber: 'SFS 2025:99',
        changedAt: new Date('2025-06-01T00:00:00Z'),
        originalUrl: null,
      },
      lastChangeAcknowledgedAt: new Date('2026-06-01T00:00:00Z'),
    })
    expect(screen.getByText('SFS 2025:99')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /SFS 2025:99/ })
    ).not.toBeInTheDocument()
  })

  it('shows "Ny" badge when changedAt > lastChangeAcknowledgedAt', () => {
    renderDetailsBox({
      latestAmendment: {
        sfsNumber: 'SFS 2026:50',
        changedAt: new Date('2026-04-01T00:00:00Z'),
        originalUrl: 'https://example.com/sfs.pdf',
      },
      lastChangeAcknowledgedAt: new Date('2026-01-01T00:00:00Z'),
    })
    expect(screen.getByText('Ny')).toBeInTheDocument()
  })

  it('shows "Ny" badge when lastChangeAcknowledgedAt is null (never acknowledged)', () => {
    renderDetailsBox({
      latestAmendment: {
        sfsNumber: 'SFS 2025:1',
        changedAt: new Date('2025-01-09T00:00:00Z'),
        originalUrl: 'https://example.com/sfs.pdf',
      },
      lastChangeAcknowledgedAt: null,
    })
    expect(screen.getByText('Ny')).toBeInTheDocument()
  })

  it('hides "Ny" badge when changedAt <= lastChangeAcknowledgedAt', () => {
    renderDetailsBox({
      latestAmendment: {
        sfsNumber: 'SFS 2024:200',
        changedAt: new Date('2024-12-01T00:00:00Z'),
        originalUrl: 'https://example.com/sfs.pdf',
      },
      lastChangeAcknowledgedAt: new Date('2025-06-01T00:00:00Z'),
    })
    expect(screen.queryByText('Ny')).not.toBeInTheDocument()
    // Row itself still rendered
    expect(screen.getByText('Senaste ändring')).toBeInTheDocument()
  })
})

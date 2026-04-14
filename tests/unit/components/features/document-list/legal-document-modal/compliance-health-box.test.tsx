/**
 * Story 17.18: ComplianceHealthBox tests
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'
import type { ReactElement } from 'react'
import { ComplianceHealthBox } from '@/components/features/document-list/legal-document-modal/compliance-health-box'
import {
  getLinkedArtifactsForListItem,
  type LinkedArtifactsResult,
} from '@/app/actions/linked-artifacts'
import {
  getRequirementsForListItem,
  type RequirementWithEvidence,
} from '@/app/actions/law-list-item-requirements'

function renderFresh(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>{ui}</SWRConfig>
  )
}

vi.mock('@/app/actions/linked-artifacts', () => ({
  getLinkedArtifactsForListItem: vi.fn(),
}))
vi.mock('@/app/actions/law-list-item-requirements', () => ({
  getRequirementsForListItem: vi.fn(),
}))

const LIST_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function mockArtifacts(data: Partial<LinkedArtifactsResult> = {}) {
  ;(getLinkedArtifactsForListItem as unknown as Mock).mockResolvedValue({
    success: true,
    data: {
      artifacts: data.artifacts ?? [],
      tasksWithoutAttachmentCount: data.tasksWithoutAttachmentCount ?? 0,
    },
  })
}

function mockRequirements(rows: Partial<RequirementWithEvidence>[]) {
  ;(getRequirementsForListItem as unknown as Mock).mockResolvedValue({
    success: true,
    data: rows.map((r, i) => ({
      id: r.id ?? `r-${i}`,
      text: r.text ?? `Krav ${i}`,
      isFulfilled: r.isFulfilled ?? false,
      bevisRequired: r.bevisRequired ?? false,
      position: r.position ?? (i + 1) * 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      evidence: r.evidence ?? [],
    })),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ComplianceHealthBox', () => {
  it('always shows total artifacts count, even at zero', async () => {
    mockArtifacts({ artifacts: [] })
    mockRequirements([])
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={vi.fn()}
        onKravpunkterGapClick={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByText('0 länkade filer och dokument')
      ).toBeInTheDocument()
    )
  })

  it('renders correct counts and pluralization', async () => {
    mockArtifacts({
      artifacts: [
        {
          kind: 'file',
          id: 'f-1',
          directLink: true,
          requirements: [],
          tasks: [],
        },
      ],
    })
    mockRequirements([{ id: 'r-1', bevisRequired: true, evidence: [] }])
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={vi.fn()}
        onKravpunkterGapClick={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(
        screen.getByText('1 länkad fil eller dokument')
      ).toBeInTheDocument()
      expect(screen.getByText('1 kravpunkt saknar bevis')).toBeInTheDocument()
    })
  })

  it('omits "kravpunkter saknar bevis" row when zero', async () => {
    mockArtifacts({})
    mockRequirements([
      { id: 'r-1', bevisRequired: false, evidence: [] }, // not required → no gap
      {
        id: 'r-2',
        bevisRequired: true,
        evidence: [
          {
            id: 'e-1',
            linkedAt: new Date(),
            file: { id: 'f-1', filename: 'a.pdf', mimeType: 'application/pdf' },
            workspaceDocument: null,
          },
        ],
      }, // required AND has evidence → no gap
    ])
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={vi.fn()}
        onKravpunkterGapClick={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByText('0 länkade filer och dokument')
      ).toBeInTheDocument()
    )
    expect(screen.queryByText(/saknar bevis/i)).not.toBeInTheDocument()
  })

  it('does not surface a tasks-without-attachment row (removed in 17.18 polish)', async () => {
    mockArtifacts({
      artifacts: [
        {
          kind: 'file',
          id: 'f-1',
          directLink: true,
          requirements: [],
          tasks: [],
        },
      ],
      tasksWithoutAttachmentCount: 3,
    })
    mockRequirements([])
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={vi.fn()}
        onKravpunkterGapClick={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByText('1 länkad fil eller dokument')
      ).toBeInTheDocument()
    )
    expect(screen.queryByText(/utan bifogat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/uppgift(er)?/i)).not.toBeInTheDocument()
  })

  it('clicking the artifacts row fires onLinkedArtifactsClick', async () => {
    const onLinkedArtifactsClick = vi.fn()
    mockArtifacts({
      artifacts: [
        {
          kind: 'file',
          id: 'f-1',
          directLink: true,
          requirements: [],
          tasks: [],
        },
      ],
    })
    mockRequirements([])
    const user = userEvent.setup()
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={onLinkedArtifactsClick}
        onKravpunkterGapClick={vi.fn()}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByText('1 länkad fil eller dokument')
      ).toBeInTheDocument()
    )
    await user.click(screen.getByText('1 länkad fil eller dokument'))
    expect(onLinkedArtifactsClick).toHaveBeenCalledTimes(1)
  })

  it('clicking the kravpunkter gap row fires onKravpunkterGapClick (not the artifacts callback)', async () => {
    const onLinkedArtifactsClick = vi.fn()
    const onKravpunkterGapClick = vi.fn()
    mockArtifacts({})
    mockRequirements([{ id: 'r-1', bevisRequired: true, evidence: [] }])
    const user = userEvent.setup()
    renderFresh(
      <ComplianceHealthBox
        listItemId={LIST_ITEM_ID}
        onLinkedArtifactsClick={onLinkedArtifactsClick}
        onKravpunkterGapClick={onKravpunkterGapClick}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('1 kravpunkt saknar bevis')).toBeInTheDocument()
    )
    await user.click(screen.getByText('1 kravpunkt saknar bevis'))
    expect(onKravpunkterGapClick).toHaveBeenCalledTimes(1)
    expect(onLinkedArtifactsClick).not.toHaveBeenCalled()
  })
})

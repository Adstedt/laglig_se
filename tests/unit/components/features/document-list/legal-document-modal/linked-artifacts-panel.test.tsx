/**
 * Story 17.18: LinkedArtifactsPanel component tests
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig } from 'swr'
import { Accordion } from '@/components/ui/accordion'
import type { ReactElement } from 'react'
import { LinkedArtifactsPanel } from '@/components/features/document-list/legal-document-modal/linked-artifacts-panel'
import {
  getLinkedArtifactsForListItem,
  type LinkedArtifact,
} from '@/app/actions/linked-artifacts'

function renderFresh(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Accordion type="multiple" defaultValue={['linked-artifacts']}>
        {ui}
      </Accordion>
    </SWRConfig>
  )
}

vi.mock('@/app/actions/linked-artifacts', () => ({
  getLinkedArtifactsForListItem: vi.fn(),
}))
vi.mock('@/app/actions/files', () => ({
  uploadFileAndLinkToListItem: vi.fn(),
  linkFilesToListItem: vi.fn(),
  unlinkFile: vi.fn(),
  getFileDownloadUrl: vi.fn(),
}))
vi.mock('@/app/actions/documents', () => ({
  linkDocumentToListItem: vi.fn(),
  unlinkDocumentFromListItem: vi.fn(),
}))
vi.mock('@/components/features/files/file-picker-modal', () => ({
  FilePickerModal: () => null,
}))
vi.mock('@/components/features/documents/document-picker-modal', () => ({
  DocumentPickerModal: () => null,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}))

const LIST_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function mkFile(overrides: Partial<LinkedArtifact> = {}): LinkedArtifact {
  return {
    kind: 'file',
    id: 'f-1',
    filename: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048,
    directLink: true,
    requirements: [],
    tasks: [],
    ...overrides,
  }
}

function mkDoc(overrides: Partial<LinkedArtifact> = {}): LinkedArtifact {
  return {
    kind: 'document',
    id: 'd-1',
    title: 'GDPR Policy',
    documentType: 'POLICY',
    status: 'APPROVED',
    versionNumber: 2,
    directLink: true,
    requirements: [],
    tasks: [],
    ...overrides,
  }
}

function mockData(
  artifacts: LinkedArtifact[],
  tasksWithoutAttachmentCount = 0
) {
  ;(getLinkedArtifactsForListItem as unknown as Mock).mockResolvedValue({
    success: true,
    data: { artifacts, tasksWithoutAttachmentCount },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LinkedArtifactsPanel', () => {
  it('shows empty state when no artifacts linked', async () => {
    mockData([])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )
    await waitFor(() =>
      expect(
        screen.getByText('Inga länkade filer eller dokument')
      ).toBeInTheDocument()
    )
  })

  it('renders the total count in the accordion header', async () => {
    mockData([mkFile(), mkDoc({ id: 'd-1' })])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )
    await waitFor(() => {
      expect(screen.getByText('Länkade filer & dokument')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('renders files and styrdokument with distinct primary metadata', async () => {
    mockData([
      mkFile({ id: 'f-1', filename: 'foto.jpg' }),
      mkDoc({ id: 'd-1', title: 'Arbetsmiljöpolicy' }),
    ])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByText('foto.jpg')).toBeInTheDocument()
    )
    expect(screen.getByText('Arbetsmiljöpolicy')).toBeInTheDocument()
    expect(screen.getByText('Policy')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('renders consolidated icon+count back-reference chips', async () => {
    mockData([
      mkFile({
        id: 'f-multi',
        directLink: true,
        requirements: [{ id: 'r-1', text: 'Skyddsutrustning' }],
        tasks: [{ id: 't-1', title: 'Årlig kontroll' }],
      }),
    ])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Direktlänkad')).toBeInTheDocument()
    )
    expect(screen.getByLabelText('Bevis för 1 kravpunkt')).toBeInTheDocument()
    expect(screen.getByLabelText('Bifogad till 1 uppgift')).toBeInTheDocument()
  })

  it('chips show counts when an artifact is bevis for multiple kravpunkter', async () => {
    mockData([
      mkFile({
        id: 'f-many',
        directLink: true,
        requirements: [
          { id: 'r-1', text: 'Krav A' },
          { id: 'r-2', text: 'Krav B' },
          { id: 'r-3', text: 'Krav C' },
        ],
        tasks: [{ id: 't-1', title: 'Uppgift A' }],
      }),
    ])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Direktlänkad')).toBeInTheDocument()
    )
    expect(screen.getByLabelText('Bevis för 3 kravpunkter')).toBeInTheDocument()
    expect(screen.getByLabelText('Bifogad till 1 uppgift')).toBeInTheDocument()
  })

  it('filter "Bevis" hides direct-only artifacts', async () => {
    mockData([
      mkFile({
        id: 'f-direct',
        filename: 'direct.pdf',
        directLink: true,
        requirements: [],
        tasks: [],
      }),
      mkFile({
        id: 'f-bevis',
        filename: 'bevis.pdf',
        directLink: false,
        requirements: [{ id: 'r-1', text: 'Krav 1' }],
      }),
    ])
    const user = userEvent.setup()
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByText('direct.pdf')).toBeInTheDocument()
    )
    expect(screen.getByText('bevis.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Bevis' }))

    expect(screen.queryByText('direct.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('bevis.pdf')).toBeInTheDocument()
  })

  it('type toggle: unchecking "Filer" hides file artifacts', async () => {
    mockData([
      mkFile({ id: 'f-1', filename: 'just-a-file.pdf' }),
      mkDoc({ id: 'd-1', title: 'Some Policy' }),
    ])
    const user = userEvent.setup()
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByText('just-a-file.pdf')).toBeInTheDocument()
    )

    const filerCheckbox = screen.getByRole('checkbox', { name: 'Filer' })
    await user.click(filerCheckbox)

    expect(screen.queryByText('just-a-file.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Some Policy')).toBeInTheDocument()
  })

  it('shows "no matching artifacts" + reset link when filters exclude everything', async () => {
    mockData([
      mkFile({ id: 'f-1', directLink: true, requirements: [], tasks: [] }),
    ])
    const user = userEvent.setup()
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByText('receipt.pdf')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('radio', { name: 'Bevis' }))

    expect(screen.getByText('Inga matchande artefakter')).toBeInTheDocument()
    expect(screen.getByText('Återställ filter')).toBeInTheDocument()
  })

  it('read-only mode hides upload/link/unlink actions', async () => {
    mockData([mkFile({ directLink: true })])
    renderFresh(
      <LinkedArtifactsPanel
        entity={{ type: 'list_item', id: LIST_ITEM_ID }}
        readOnly
      />
    )

    await waitFor(() =>
      expect(screen.getByText('receipt.pdf')).toBeInTheDocument()
    )

    expect(
      screen.queryByRole('button', { name: /Ladda upp fil/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Länka fil/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Länka styrdokument/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Ta bort länk/i })
    ).not.toBeInTheDocument()
  })

  it('indirect-only artifact: no enabled unlink button', async () => {
    mockData([
      mkFile({
        id: 'f-indirect',
        filename: 'indirect.pdf',
        directLink: false,
        requirements: [{ id: 'r-1', text: 'Krav' }],
      }),
    ])
    renderFresh(
      <LinkedArtifactsPanel entity={{ type: 'list_item', id: LIST_ITEM_ID }} />
    )

    await waitFor(() =>
      expect(screen.getByText('indirect.pdf')).toBeInTheDocument()
    )

    // The "Ta bort länk" enabled button (canUnlink path) should not appear;
    // the disabled placeholder button is rendered (but disabled).
    const enabledUnlink = screen.queryByRole('button', { name: 'Ta bort länk' })
    expect(enabledUnlink).not.toBeInTheDocument()
    const disabledUnlink = screen.getByRole('button', {
      name: /Kan inte tas bort härifrån/i,
    })
    expect(disabledUnlink).toBeDisabled()
  })
})

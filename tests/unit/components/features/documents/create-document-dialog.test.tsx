import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock server action
vi.mock('@/app/actions/documents', () => ({
  saveDocumentVersion: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'ver-1', versionNumber: 2 },
  }),
  createDocument: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'doc-1', title: 'Test', versionNumber: 1 },
  }),
  getDocumentTemplates: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  linkDocumentToTask: vi.fn().mockResolvedValue({ success: true }),
  linkDocumentToListItem: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/app/actions/law-list-item-requirements', () => ({
  linkEvidenceToRequirement: vi.fn().mockResolvedValue({ success: true }),
  getRequirementsForListItem: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
}))

vi.mock('@/app/actions/tasks', () => ({
  getTasksForLinking: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getWorkspaceLawLists: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getLawListItemsForLinking: vi
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

describe('CreateDocumentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with title and type fields when open', async () => {
    const { CreateDocumentDialog } = await import(
      '@/components/features/documents/create-document-dialog'
    )

    render(<CreateDocumentDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Nytt dokument')).toBeDefined()
    expect(screen.getByLabelText(/^Titel/)).toBeDefined()
    expect(screen.getByLabelText('Dokumenttyp')).toBeDefined()
    expect(screen.getByText('Skapa dokument')).toBeDefined()
    expect(screen.getByText('Avbryt')).toBeDefined()
  })

  it('shows validation error when title is empty', async () => {
    const { CreateDocumentDialog } = await import(
      '@/components/features/documents/create-document-dialog'
    )

    render(<CreateDocumentDialog open={true} onOpenChange={vi.fn()} />)

    const submitBtn = screen.getByText('Skapa dokument')
    await userEvent.click(submitBtn)

    // Should show validation error — title is required
    expect(await screen.findByText('Titel krävs')).toBeDefined()
  })

  it('calls createDocument on valid submit', async () => {
    const { CreateDocumentDialog } = await import(
      '@/components/features/documents/create-document-dialog'
    )
    const { createDocument } = await import('@/app/actions/documents')

    const onOpenChange = vi.fn()
    render(<CreateDocumentDialog open={true} onOpenChange={onOpenChange} />)

    // Fill in title
    const titleInput = screen.getByLabelText(/^Titel/)
    await userEvent.type(titleInput, 'Arbetsmiljöpolicy 2026')

    // Submit
    const submitBtn = screen.getByText('Skapa dokument')
    await userEvent.click(submitBtn)

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Arbetsmiljöpolicy 2026',
        documentType: 'OTHER',
      })
    )
  })

  it('does not render dialog when closed', async () => {
    const { CreateDocumentDialog } = await import(
      '@/components/features/documents/create-document-dialog'
    )

    render(<CreateDocumentDialog open={false} onOpenChange={vi.fn()} />)

    expect(screen.queryByText('Nytt dokument')).toBeNull()
  })
})

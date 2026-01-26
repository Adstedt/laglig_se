/**
 * Story 6.7a: FilePickerModal Component Tests
 * Tests file selection, search, and multi-select behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilePickerModal } from '@/components/features/files/file-picker-modal'

// Mock the file actions
vi.mock('@/app/actions/files', () => ({
  getWorkspaceFiles: vi.fn(),
}))

// Mock the file-card module for category labels/colors
vi.mock('@/components/features/files/file-card', () => ({
  categoryLabels: {
    BEVIS: 'Bevis',
    POLICY: 'Policy',
    AVTAL: 'Avtal',
    CERTIFIKAT: 'Certifikat',
    OVRIGT: 'Övrigt',
  },
  categoryColors: {
    BEVIS: 'bg-blue-100 text-blue-800',
    POLICY: 'bg-purple-100 text-purple-800',
    AVTAL: 'bg-green-100 text-green-800',
    CERTIFIKAT: 'bg-yellow-100 text-yellow-800',
    OVRIGT: 'bg-gray-100 text-gray-800',
  },
}))

import { getWorkspaceFiles } from '@/app/actions/files'

const mockFiles = [
  {
    id: 'file_1',
    filename: 'dokument1.pdf',
    original_filename: 'dokument1.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    category: 'BEVIS',
    workspace_id: 'ws_123',
    uploaded_by: 'user_123',
    storage_path: 'path/to/file1',
    description: null,
    created_at: new Date(),
    updated_at: new Date(),
    uploader: {
      id: 'user_123',
      name: 'Test',
      email: 'test@test.com',
      avatar_url: null,
    },
    task_links: [],
    list_item_links: [],
  },
  {
    id: 'file_2',
    filename: 'bild.png',
    original_filename: 'bild.png',
    file_size: 2048,
    mime_type: 'image/png',
    category: 'OVRIGT',
    workspace_id: 'ws_123',
    uploaded_by: 'user_123',
    storage_path: 'path/to/file2',
    description: null,
    created_at: new Date(),
    updated_at: new Date(),
    uploader: {
      id: 'user_123',
      name: 'Test',
      email: 'test@test.com',
      avatar_url: null,
    },
    task_links: [],
    list_item_links: [],
  },
  {
    id: 'file_3',
    filename: 'policy.docx',
    original_filename: 'policy.docx',
    file_size: 4096,
    mime_type:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'POLICY',
    workspace_id: 'ws_123',
    uploaded_by: 'user_123',
    storage_path: 'path/to/file3',
    description: null,
    created_at: new Date(),
    updated_at: new Date(),
    uploader: {
      id: 'user_123',
      name: 'Test',
      email: 'test@test.com',
      avatar_url: null,
    },
    task_links: [],
    list_item_links: [],
  },
]

describe('FilePickerModal', () => {
  const mockOnSelect = vi.fn()
  const mockOnOpenChange = vi.fn()
  const mockOnUploadNew = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      success: true,
      data: {
        files: mockFiles,
        pagination: {
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
    })
  })

  it('renders when open', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sök filer/i)).toBeInTheDocument()
    })
  })

  it('loads files when opened', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(getWorkspaceFiles).toHaveBeenCalled()
    })
  })

  it('displays loaded files', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
      expect(screen.getByText('bild.png')).toBeInTheDocument()
      expect(screen.getByText('policy.docx')).toBeInTheDocument()
    })
  })

  it('shows file sizes', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('1.0 KB')).toBeInTheDocument()
      expect(screen.getByText('2.0 KB')).toBeInTheDocument()
      expect(screen.getByText('4.0 KB')).toBeInTheDocument()
    })
  })

  it('shows category badges', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Bevis')).toBeInTheDocument()
      expect(screen.getByText('Övrigt')).toBeInTheDocument()
      expect(screen.getByText('Policy')).toBeInTheDocument()
    })
  })

  it('allows selecting files', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // Click on a file item to select it
    const fileItem = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (fileItem) {
      await user.click(fileItem)
    }

    // Should show selected count
    await waitFor(() => {
      expect(screen.getByText(/1 fil.*vald/i)).toBeInTheDocument()
    })
  })

  it('allows multi-select by default', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // Select first file
    const file1 = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (file1) await user.click(file1)

    // Select second file
    const file2 = screen.getByText('bild.png').closest('[cmdk-item]')
    if (file2) await user.click(file2)

    // Should show 2 files selected
    await waitFor(() => {
      expect(screen.getByText(/2 filer.*valda/i)).toBeInTheDocument()
    })
  })

  it('deselects file on second click', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    const fileItem = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (fileItem) {
      // Select
      await user.click(fileItem)
      await waitFor(() => {
        expect(screen.getByText(/1 fil.*vald/i)).toBeInTheDocument()
      })

      // Deselect
      await user.click(fileItem)
      await waitFor(() => {
        expect(screen.getByText(/0 filer.*valda/i)).toBeInTheDocument()
      })
    }
  })

  it('calls onSelect with selected file IDs on confirm', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // Select a file
    const fileItem = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (fileItem) await user.click(fileItem)

    // Click confirm button
    const confirmButton = screen.getByRole('button', {
      name: /lägg till valda/i,
    })
    await user.click(confirmButton)

    expect(mockOnSelect).toHaveBeenCalledWith(['file_1'])
  })

  it('disables confirm button when no files selected', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', {
      name: /lägg till valda/i,
    })
    expect(confirmButton).toBeDisabled()
  })

  it('shows already linked files as disabled', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
        excludeIds={['file_1']}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // The already linked file should be in a separate group
    expect(screen.getByText(/redan länkade/i)).toBeInTheDocument()
  })

  it('shows upload button when onUploadNew provided', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
        onUploadNew={mockOnUploadNew}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /ladda upp ny/i })
      ).toBeInTheDocument()
    })
  })

  it('calls onUploadNew when upload button clicked', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
        onUploadNew={mockOnUploadNew}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /ladda upp ny/i })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /ladda upp ny/i }))

    expect(mockOnUploadNew).toHaveBeenCalled()
  })

  it('shows cancel button', async () => {
    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /avbryt/i })
      ).toBeInTheDocument()
    })
  })

  it('calls onOpenChange(false) when cancel clicked', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /avbryt/i })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /avbryt/i }))

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('resets selection when modal closes', async () => {
    const { rerender } = render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // Select a file
    const user = userEvent.setup()
    const fileItem = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (fileItem) await user.click(fileItem)

    // Close modal
    rerender(
      <FilePickerModal
        open={false}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    // Reopen modal
    rerender(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/0 filer.*valda/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no files found', async () => {
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      success: true,
      data: {
        files: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
    })

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/inga filer hittades/i)).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching files', async () => {
    // Make the request pending
    vi.mocked(getWorkspaceFiles).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {
                  files: [],
                  pagination: {
                    page: 1,
                    limit: 50,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                  },
                },
              }),
            100
          )
        )
    )

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    // Should show loading indicator (spinner has animate-spin class)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('supports single select mode', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
        allowMultiple={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('dokument1.pdf')).toBeInTheDocument()
    })

    // Select first file
    const file1 = screen.getByText('dokument1.pdf').closest('[cmdk-item]')
    if (file1) await user.click(file1)

    await waitFor(() => {
      expect(screen.getByText(/1 fil.*vald/i)).toBeInTheDocument()
    })

    // Select second file - should replace first selection
    const file2 = screen.getByText('bild.png').closest('[cmdk-item]')
    if (file2) await user.click(file2)

    // Still should be 1 file selected
    await waitFor(() => {
      expect(screen.getByText(/1 fil.*vald/i)).toBeInTheDocument()
    })
  })

  it('performs search when user types', async () => {
    const user = userEvent.setup()

    render(
      <FilePickerModal
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelect={mockOnSelect}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/sök filer/i)).toBeInTheDocument()
    })

    // Initial load
    expect(getWorkspaceFiles).toHaveBeenCalled()

    const searchInput = screen.getByPlaceholderText(/sök filer/i)
    await user.type(searchInput, 'test')

    // After debounce, should call with search
    await waitFor(
      () => {
        expect(getWorkspaceFiles).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test' }),
          expect.anything()
        )
      },
      { timeout: 1000 }
    )
  })
})

/**
 * Story 6.7a: FileDropzone Component Tests
 * Tests file validation, drag-and-drop behavior, and upload UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  FileDropzone,
  validateFile,
  formatFileSize,
  getFileIcon,
  MAX_FILE_SIZE,
  ACCEPTED_TYPES,
} from '@/components/features/files/file-dropzone'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

import { toast } from 'sonner'

describe('validateFile', () => {
  it('rejects files over max size', () => {
    const largeFile = new File(['x'.repeat(26 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(largeFile, 'size', { value: 26 * 1024 * 1024 })

    const result = validateFile(largeFile)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('för stor')
  })

  it('rejects invalid file types', () => {
    const invalidFile = new File(['content'], 'test.exe', {
      type: 'application/x-msdownload',
    })

    const result = validateFile(invalidFile)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('stöds inte')
  })

  it('accepts valid PDF files', () => {
    const validFile = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    })

    const result = validateFile(validFile)

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts valid image files', () => {
    const pngFile = new File(['content'], 'test.png', { type: 'image/png' })
    const jpegFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    const gifFile = new File(['content'], 'test.gif', { type: 'image/gif' })

    expect(validateFile(pngFile).valid).toBe(true)
    expect(validateFile(jpegFile).valid).toBe(true)
    expect(validateFile(gifFile).valid).toBe(true)
  })

  it('accepts Office documents', () => {
    const docxFile = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const xlsxFile = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const pptxFile = new File(['content'], 'test.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })

    expect(validateFile(docxFile).valid).toBe(true)
    expect(validateFile(xlsxFile).valid).toBe(true)
    expect(validateFile(pptxFile).valid).toBe(true)
  })

  it('respects custom maxSize option', () => {
    const smallFile = new File(['x'], 'small.pdf', { type: 'application/pdf' })
    Object.defineProperty(smallFile, 'size', { value: 1024 }) // 1KB

    const result = validateFile(smallFile, { maxSize: 512 }) // 512 bytes max

    expect(result.valid).toBe(false)
    expect(result.error).toContain('för stor')
  })

  it('respects custom acceptedTypes option', () => {
    const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' })

    // Default should reject
    expect(validateFile(txtFile).valid).toBe(false)

    // Custom types should accept
    const result = validateFile(txtFile, { acceptedTypes: ['text/plain'] })
    expect(result.valid).toBe(true)
  })
})

describe('formatFileSize', () => {
  it('formats bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('getFileIcon', () => {
  it('returns image icon for image types', () => {
    const icon = getFileIcon('image/png')
    expect(icon).toBeTruthy()
  })

  it('returns PDF icon for PDF files', () => {
    const icon = getFileIcon('application/pdf')
    expect(icon).toBeTruthy()
  })

  it('returns spreadsheet icon for Excel files', () => {
    const icon = getFileIcon(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(icon).toBeTruthy()
  })

  it('returns document icon for Word files', () => {
    const icon = getFileIcon(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(icon).toBeTruthy()
  })

  it('returns generic icon for unknown types', () => {
    const icon = getFileIcon('application/octet-stream')
    expect(icon).toBeTruthy()
  })
})

describe('FileDropzone', () => {
  const mockOnUpload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpload.mockResolvedValue(undefined)
  })

  it('renders dropzone with upload instructions', () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    expect(screen.getByText(/dra och släpp filer här/i)).toBeInTheDocument()
    expect(screen.getByText(/eller välj fil/i)).toBeInTheDocument()
  })

  it('renders file size limit info', () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    expect(screen.getByText(/max 25/i)).toBeInTheDocument()
  })

  it('shows compact variant', () => {
    render(<FileDropzone onUpload={mockOnUpload} variant="compact" />)

    expect(screen.getByText(/dra filer hit/i)).toBeInTheDocument()
    // Compact version doesn't show size limit text
    expect(screen.queryByText(/max 25/i)).not.toBeInTheDocument()
  })

  it('applies drag-over styling when dragging', () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')

    fireEvent.dragOver(dropzone)

    expect(dropzone).toHaveClass('border-primary')
  })

  it('removes drag-over styling on drag leave', () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')

    fireEvent.dragOver(dropzone)
    fireEvent.dragLeave(dropzone)

    expect(dropzone).not.toHaveClass('border-primary')
  })

  it('handles file drop', async () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([file])
    })
  })

  it('shows error toast for invalid file type', async () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const invalidFile = new File(['content'], 'test.exe', {
      type: 'application/x-msdownload',
    })

    const dataTransfer = {
      files: [invalidFile],
      items: [
        {
          kind: 'file',
          type: 'application/x-msdownload',
          getAsFile: () => invalidFile,
        },
      ],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    expect(mockOnUpload).not.toHaveBeenCalled()
  })

  it('enforces max files limit', async () => {
    render(
      <FileDropzone onUpload={mockOnUpload} maxFiles={5} currentFileCount={4} />
    )

    const dropzone = screen.getByTestId('dropzone')
    const files = [
      new File(['1'], 'test1.pdf', { type: 'application/pdf' }),
      new File(['2'], 'test2.pdf', { type: 'application/pdf' }),
    ]

    const dataTransfer = {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: 'application/pdf',
        getAsFile: () => f,
      })),
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Max 5'))
    })

    expect(mockOnUpload).not.toHaveBeenCalled()
  })

  it('handles file input selection via click', async () => {
    const user = userEvent.setup()
    render(<FileDropzone onUpload={mockOnUpload} />)

    const selectButton = screen.getByText(/eller välj fil/i)
    const fileInput = screen.getByTestId('file-input')

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    await user.click(selectButton)

    // Simulate file selection
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([file])
    })
  })

  it('shows uploading state during upload', async () => {
    // Make upload take some time
    mockOnUpload.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/laddar upp/i)).toBeInTheDocument()
    })
  })

  it('shows cancel button during upload', async () => {
    mockOnUpload.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )

    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(screen.getByText(/avbryt/i)).toBeInTheDocument()
    })
  })

  it('disables dropzone when disabled prop is true', () => {
    render(<FileDropzone onUpload={mockOnUpload} disabled />)

    const dropzone = screen.getByTestId('dropzone')
    expect(dropzone).toHaveClass('pointer-events-none')
    expect(dropzone).toHaveClass('opacity-50')
  })

  it('shows success toast after successful upload', async () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('laddats upp')
      )
    })
  })

  it('shows plural message for multiple files', async () => {
    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const files = [
      new File(['1'], 'test1.pdf', { type: 'application/pdf' }),
      new File(['2'], 'test2.pdf', { type: 'application/pdf' }),
    ]

    const dataTransfer = {
      files,
      items: files.map((f) => ({
        kind: 'file',
        type: 'application/pdf',
        getAsFile: () => f,
      })),
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('2'))
    })
  })

  it('shows error toast when upload fails', async () => {
    mockOnUpload.mockRejectedValue(new Error('Upload failed'))

    render(<FileDropzone onUpload={mockOnUpload} />)

    const dropzone = screen.getByTestId('dropzone')
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

    const dataTransfer = {
      files: [file],
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files'],
    }

    fireEvent.drop(dropzone, { dataTransfer })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Kunde inte')
      )
    })
  })
})

describe('FileDropzone constants', () => {
  it('has correct max file size (25MB)', () => {
    expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024)
  })

  it('includes all required MIME types', () => {
    const requiredTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]

    requiredTypes.forEach((type) => {
      expect(ACCEPTED_TYPES).toContain(type)
    })
  })
})

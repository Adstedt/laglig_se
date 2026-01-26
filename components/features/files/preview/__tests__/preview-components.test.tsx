/**
 * Story 6.7b: Preview Components Unit Tests
 *
 * Tests for preview component rendering, image preview, metadata display,
 * and file type handling.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-wrapper">{children}</div>
  ),
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  ),
  useControls: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetTransform: vi.fn(),
  }),
}))

// Mock exif-js
vi.mock('exif-js', () => ({
  default: {
    getData: vi.fn((_, callback) => callback.call({})),
    getAllTags: vi.fn(() => ({})),
  },
}))

// Import components after mocks
import { ImagePreview, ImagePreviewCompact } from '../image-preview'
import { MetadataPanel } from '../metadata-panel'

// ============================================================================
// ImagePreview Tests
// ============================================================================

describe('ImagePreview', () => {
  const defaultProps = {
    url: 'https://example.com/image.jpg',
    alt: 'Test image',
  }

  it('should render image with correct attributes', () => {
    render(<ImagePreview {...defaultProps} />)

    const img = screen.getByRole('img', { name: 'Test image' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
    expect(img).toHaveAttribute('alt', 'Test image')
  })

  it('should show zoom controls', () => {
    render(<ImagePreview {...defaultProps} />)

    expect(screen.getByTitle('Zooma in')).toBeInTheDocument()
    expect(screen.getByTitle('Zooma ut')).toBeInTheDocument()
    expect(screen.getByTitle('Återställ')).toBeInTheDocument()
  })

  it('should show fullscreen button when onFullscreen is provided', () => {
    const onFullscreen = vi.fn()
    render(<ImagePreview {...defaultProps} onFullscreen={onFullscreen} />)

    const fullscreenBtn = screen.getByTitle('Helskärm')
    expect(fullscreenBtn).toBeInTheDocument()
  })

  it('should not show fullscreen button when onFullscreen is not provided', () => {
    render(<ImagePreview {...defaultProps} />)

    expect(screen.queryByTitle('Helskärm')).not.toBeInTheDocument()
  })

  it('should show error state when image fails to load', async () => {
    render(<ImagePreview {...defaultProps} />)

    const img = screen.getByRole('img', { name: 'Test image' })
    fireEvent.error(img)

    expect(screen.getByText('Kunde inte läsa in bilden')).toBeInTheDocument()
    expect(screen.getByText('Försök igen')).toBeInTheDocument()
  })

  it('should have retry button in error state', async () => {
    render(<ImagePreview {...defaultProps} />)

    const img = screen.getByRole('img', { name: 'Test image' })
    fireEvent.error(img)

    const retryButton = screen.getByRole('button', { name: /försök igen/i })
    expect(retryButton).toBeInTheDocument()
  })
})

describe('ImagePreviewCompact', () => {
  const defaultProps = {
    url: 'https://example.com/thumb.jpg',
    alt: 'Thumbnail',
  }

  it('should render compact image with correct attributes', () => {
    render(<ImagePreviewCompact {...defaultProps} />)

    const img = screen.getByRole('img', { name: 'Thumbnail' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg')
  })

  it('should apply className when provided', () => {
    const { container } = render(
      <ImagePreviewCompact {...defaultProps} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

// ============================================================================
// MetadataPanel Tests
// ============================================================================

describe('MetadataPanel', () => {
  const mockFile = {
    filename: 'test-document.pdf',
    original_filename: 'original-name.pdf',
    file_size: 1024 * 1024 * 2.5, // 2.5 MB
    mime_type: 'application/pdf',
    created_at: new Date('2024-01-15T10:30:00'),
    updated_at: new Date('2024-01-16T14:20:00'),
  }

  it('should display filename', () => {
    render(<MetadataPanel file={mockFile} />)

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
  })

  it('should display original filename if different', () => {
    render(<MetadataPanel file={mockFile} />)

    expect(screen.getByText('original-name.pdf')).toBeInTheDocument()
  })

  it('should not display original filename if same as filename', () => {
    const file = {
      ...mockFile,
      original_filename: mockFile.filename,
    }
    render(<MetadataPanel file={file} />)

    // Should only appear once (as filename)
    expect(screen.getAllByText('test-document.pdf')).toHaveLength(1)
  })

  it('should format file size correctly', () => {
    render(<MetadataPanel file={mockFile} />)

    expect(screen.getByText('2.5 MB')).toBeInTheDocument()
  })

  it('should display mime type', () => {
    render(<MetadataPanel file={mockFile} />)

    expect(screen.getByText('application/pdf')).toBeInTheDocument()
  })

  it('should display formatted upload date', () => {
    render(<MetadataPanel file={mockFile} />)

    // Date is formatted in Swedish locale
    expect(screen.getByText(/15 januari 2024/)).toBeInTheDocument()
  })

  it('should display PDF page count when provided', () => {
    render(<MetadataPanel file={mockFile} pdfPageCount={42} />)

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Antal sidor')).toBeInTheDocument()
  })

  it('should display image dimensions when provided', () => {
    const imageFile = {
      ...mockFile,
      mime_type: 'image/jpeg',
    }
    render(
      <MetadataPanel
        file={imageFile}
        imageDimensions={{ width: 1920, height: 1080 }}
      />
    )

    expect(screen.getByText('1920 × 1080 px')).toBeInTheDocument()
  })

  it('should show properties button for image files', () => {
    const imageFile = {
      ...mockFile,
      mime_type: 'image/jpeg',
    }
    render(<MetadataPanel file={imageFile} />)

    expect(screen.getByText('Egenskaper')).toBeInTheDocument()
  })

  it('should not show properties button for non-image, non-PDF files', () => {
    const docFile = {
      ...mockFile,
      mime_type: 'application/msword',
    }
    render(<MetadataPanel file={docFile} />)

    expect(screen.queryByText('Egenskaper')).not.toBeInTheDocument()
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Metadata Helper Functions', () => {
  // Test format file size function
  describe('formatFileSize (via MetadataPanel)', () => {
    it('should format bytes', () => {
      const file = {
        filename: 'test.txt',
        file_size: 500,
        created_at: new Date(),
        updated_at: new Date(),
      }
      render(<MetadataPanel file={file} />)
      expect(screen.getByText('500 B')).toBeInTheDocument()
    })

    it('should format kilobytes', () => {
      const file = {
        filename: 'test.txt',
        file_size: 1536,
        created_at: new Date(),
        updated_at: new Date(),
      }
      render(<MetadataPanel file={file} />)
      expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    })

    it('should format megabytes', () => {
      const file = {
        filename: 'test.txt',
        file_size: 1024 * 1024 * 5,
        created_at: new Date(),
        updated_at: new Date(),
      }
      render(<MetadataPanel file={file} />)
      expect(screen.getByText('5.0 MB')).toBeInTheDocument()
    })

    it('should handle null file size', () => {
      const file = {
        filename: 'test.txt',
        file_size: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      render(<MetadataPanel file={file} />)
      expect(screen.getByText('-')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// MIME Type Detection Tests
// ============================================================================

describe('MIME Type Handling', () => {
  const createFileWithMime = (mimeType: string) => ({
    filename: 'test-file',
    mime_type: mimeType,
    created_at: new Date(),
    updated_at: new Date(),
  })

  it('should identify image MIME types', () => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    for (const mimeType of imageTypes) {
      const file = createFileWithMime(mimeType)
      const { unmount } = render(<MetadataPanel file={file} />)

      // Image files should show properties button
      expect(screen.getByText('Egenskaper')).toBeInTheDocument()
      unmount()
    }
  })

  it('should identify PDF MIME type', () => {
    const file = createFileWithMime('application/pdf')
    render(<MetadataPanel file={file} pdfPageCount={10} />)

    expect(screen.getByText('Antal sidor')).toBeInTheDocument()
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('Accessibility', () => {
  it('ImagePreview should have accessible alt text', () => {
    render(
      <ImagePreview
        url="https://example.com/image.jpg"
        alt="A descriptive image"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'A descriptive image')
  })

  it('MetadataPanel should use semantic dl/dt/dd elements', () => {
    const file = {
      filename: 'test.pdf',
      file_size: 1024,
      created_at: new Date(),
      updated_at: new Date(),
    }
    const { container } = render(<MetadataPanel file={file} />)

    expect(container.querySelector('dl')).toBeInTheDocument()
    expect(container.querySelector('dt')).toBeInTheDocument()
    expect(container.querySelector('dd')).toBeInTheDocument()
  })

  it('Zoom buttons should have title attributes', () => {
    render(<ImagePreview url="https://example.com/image.jpg" alt="Test" />)

    const zoomInBtn = screen.getByTitle('Zooma in')
    const zoomOutBtn = screen.getByTitle('Zooma ut')
    const resetBtn = screen.getByTitle('Återställ')

    expect(zoomInBtn).toHaveAttribute('title')
    expect(zoomOutBtn).toHaveAttribute('title')
    expect(resetBtn).toHaveAttribute('title')
  })
})

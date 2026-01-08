/**
 * Story 6.2: CellErrorBoundary Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CellErrorBoundary } from '@/components/features/document-list/table-cells/cell-error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'

// Wrapper component for tooltip
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

// Component that throws an error
function ThrowingComponent(): JSX.Element {
  throw new Error('Test error')
}

// Component that doesn't throw
function WorkingComponent() {
  return <span>Working content</span>
}

describe('CellErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error occurs', () => {
    render(
      <TestWrapper>
        <CellErrorBoundary>
          <WorkingComponent />
        </CellErrorBoundary>
      </TestWrapper>
    )

    expect(screen.getByText('Working content')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws error', () => {
    render(
      <TestWrapper>
        <CellErrorBoundary>
          <ThrowingComponent />
        </CellErrorBoundary>
      </TestWrapper>
    )

    // Should show the dash indicator
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <TestWrapper>
        <CellErrorBoundary fallback={<span>Custom error message</span>}>
          <ThrowingComponent />
        </CellErrorBoundary>
      </TestWrapper>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error')

    render(
      <TestWrapper>
        <CellErrorBoundary>
          <ThrowingComponent />
        </CellErrorBoundary>
      </TestWrapper>
    )

    // Should have logged the error
    expect(consoleSpy).toHaveBeenCalled()
  })
})

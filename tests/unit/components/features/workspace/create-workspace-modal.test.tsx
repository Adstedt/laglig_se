/**
 * Story 5.9: Tests for CreateWorkspaceModal component
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { CreateWorkspaceModal } from '@/components/features/workspace/create-workspace-modal'

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock server action
vi.mock('@/app/actions/workspace', () => ({
  createWorkspace: vi.fn(),
}))

// Mock useWorkspace hook
vi.mock('@/lib/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}))

import { createWorkspace } from '@/app/actions/workspace'

describe('CreateWorkspaceModal', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders modal when open is true', () => {
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Skapa ny arbetsplats')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(
        <CreateWorkspaceModal open={false} onOpenChange={mockOnOpenChange} />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders workspace name input', () => {
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      expect(screen.getByLabelText('Arbetsplatsnamn')).toBeInTheDocument()
    })

    it('renders submit and cancel buttons', () => {
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      expect(screen.getByText('Skapa arbetsplats')).toBeInTheDocument()
      expect(screen.getByText('Avbryt')).toBeInTheDocument()
    })

    it('shows trial period message', () => {
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      expect(
        screen.getByText(/14 dagars kostnadsfri provperiod/i)
      ).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('shows error for empty name on submit', async () => {
      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(screen.getByText('Arbetsplatsnamn krävs')).toBeInTheDocument()
      })
    })

    it('shows error for name exceeding 100 characters', async () => {
      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'a'.repeat(101))
      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(screen.getByText('Max 100 tecken')).toBeInTheDocument()
      })
    })
  })

  describe('form submission', () => {
    it('calls createWorkspace with form data on valid submit', async () => {
      vi.mocked(createWorkspace).mockResolvedValue({
        success: true,
        workspaceId: 'new-ws-123',
      })

      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Nytt Företag AB')
      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(createWorkspace).toHaveBeenCalled()
        const formData = vi.mocked(createWorkspace).mock.calls[0][0]
        expect(formData.get('name')).toBe('Nytt Företag AB')
      })
    })

    it('shows loading state during submission', async () => {
      vi.mocked(createWorkspace).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ success: true, workspaceId: 'ws-1' }),
              100
            )
          )
      )

      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Test')
      await user.click(screen.getByText('Skapa arbetsplats'))

      expect(screen.getByText('Skapar...')).toBeInTheDocument()
    })

    it('closes modal on successful submission', async () => {
      vi.mocked(createWorkspace).mockResolvedValue({
        success: true,
        workspaceId: 'new-ws-123',
      })

      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Test')
      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('shows error message on failed submission', async () => {
      vi.mocked(createWorkspace).mockResolvedValue({
        success: false,
        error: 'Arbetsplatsnamn krävs',
      })

      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Test')
      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(screen.getByText('Arbetsplatsnamn krävs')).toBeInTheDocument()
      })
    })

    it('refreshes router after successful creation', async () => {
      vi.mocked(createWorkspace).mockResolvedValue({
        success: true,
        workspaceId: 'new-ws-123',
      })

      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Test')
      await user.click(screen.getByText('Skapa arbetsplats'))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('cancel behavior', () => {
    it('calls onOpenChange with false when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      await user.click(screen.getByText('Avbryt'))

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('resets form when closed', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.type(input, 'Test Value')
      expect(input).toHaveValue('Test Value')

      await user.click(screen.getByText('Avbryt'))

      // Reopen modal
      rerender(
        <CreateWorkspaceModal open={true} onOpenChange={mockOnOpenChange} />
      )

      const newInput = screen.getByLabelText('Arbetsplatsnamn')
      expect(newInput).toHaveValue('')
    })
  })
})

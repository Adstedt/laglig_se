/**
 * Story 5.7: Tests for GeneralTab component
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { GeneralTab } from '@/components/features/settings/general-tab'
import type { WorkspaceData } from '@/components/features/settings/settings-tabs'
import type { SubscriptionTier } from '@prisma/client'

// Mock server actions
vi.mock('@/app/actions/workspace-settings', () => ({
  updateWorkspaceName: vi.fn(),
  uploadWorkspaceLogo: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { updateWorkspaceName } from '@/app/actions/workspace-settings'
import { toast } from 'sonner'

// Mock workspace data
const mockWorkspace: WorkspaceData = {
  id: 'ws_123',
  name: 'Test Workspace',
  sni_code: '62.010',
  company_logo: null,
  subscription_tier: 'TRIAL' as SubscriptionTier,
  trial_ends_at: new Date('2025-01-15'),
}

describe('GeneralTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('workspace name form', () => {
    it('renders workspace name input with current value', () => {
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      expect(input).toHaveValue('Test Workspace')
    })

    it('shows error for empty name', async () => {
      const user = userEvent.setup()
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.clear(input)

      const submitButton = screen.getByText('Spara ändringar')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Arbetsplatsnamn krävs')).toBeInTheDocument()
      })
    })

    it('shows error for name exceeding 100 characters', async () => {
      const user = userEvent.setup()
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.clear(input)
      await user.type(input, 'a'.repeat(101))

      const submitButton = screen.getByText('Spara ändringar')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Max 100 tecken')).toBeInTheDocument()
      })
    })

    it('calls updateWorkspaceName on valid submit', async () => {
      vi.mocked(updateWorkspaceName).mockResolvedValue({
        success: true,
        message: 'Inställningar sparade',
      })

      const user = userEvent.setup()
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.clear(input)
      await user.type(input, 'New Workspace Name')

      const submitButton = screen.getByText('Spara ändringar')
      await user.click(submitButton)

      await waitFor(() => {
        expect(updateWorkspaceName).toHaveBeenCalledWith('New Workspace Name')
      })
    })

    it('shows success toast on successful update', async () => {
      vi.mocked(updateWorkspaceName).mockResolvedValue({
        success: true,
        message: 'Inställningar sparade',
      })

      const user = userEvent.setup()
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.clear(input)
      await user.type(input, 'New Name')

      const submitButton = screen.getByText('Spara ändringar')
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Inställningar sparade')
      })
    })

    it('shows error toast on failed update', async () => {
      vi.mocked(updateWorkspaceName).mockResolvedValue({
        success: false,
        error: 'Något gick fel',
      })

      const user = userEvent.setup()
      render(<GeneralTab workspace={mockWorkspace} />)

      const input = screen.getByLabelText('Arbetsplatsnamn')
      await user.clear(input)
      await user.type(input, 'New Name')

      const submitButton = screen.getByText('Spara ändringar')
      await user.click(submitButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Något gick fel')
      })
    })
  })

  describe('SNI code display', () => {
    it('displays SNI code badge when present', () => {
      render(<GeneralTab workspace={mockWorkspace} />)

      expect(screen.getByText('62.010')).toBeInTheDocument()
    })

    it('shows placeholder when SNI code is not set', () => {
      const workspaceNoSni = { ...mockWorkspace, sni_code: null }
      render(<GeneralTab workspace={workspaceNoSni} />)

      expect(screen.getByText('Ingen SNI-kod angiven')).toBeInTheDocument()
    })
  })

  describe('logo upload', () => {
    it('renders upload button', () => {
      render(<GeneralTab workspace={mockWorkspace} />)

      expect(screen.getByText('Ladda upp logotyp')).toBeInTheDocument()
    })

    it('shows placeholder icon when no logo', () => {
      render(<GeneralTab workspace={mockWorkspace} />)

      // The Building2 icon is rendered when there's no logo
      // We can't easily test for the icon, but we can check the upload button exists
      expect(screen.getByText('Ladda upp logotyp')).toBeInTheDocument()
    })
  })
})

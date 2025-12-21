/**
 * Story 5.9: Tests for WorkspaceSwitcher component
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock useWorkspace hook
vi.mock('@/lib/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}))

import { useWorkspace } from '@/lib/hooks/use-workspace'

const mockWorkspaceContext = {
  workspaceId: 'ws_1',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE',
  role: 'OWNER',
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const mockWorkspaces = [
  {
    id: 'ws_1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    role: 'OWNER',
    status: 'ACTIVE',
    company_logo: null,
  },
  {
    id: 'ws_2',
    name: 'Other Workspace',
    slug: 'other-workspace',
    role: 'MEMBER',
    status: 'ACTIVE',
    company_logo: 'https://example.com/logo.png',
  },
  {
    id: 'ws_3',
    name: 'Client Workspace',
    slug: 'client-workspace',
    role: 'AUDITOR',
    status: 'ACTIVE',
    company_logo: null,
  },
]

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWorkspace).mockReturnValue(
      mockWorkspaceContext as ReturnType<typeof useWorkspace>
    )
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ workspaces: mockWorkspaces }),
    })
  })

  describe('trigger button', () => {
    it('renders current workspace name and role', () => {
      render(<WorkspaceSwitcher />)

      expect(screen.getByText('Test Workspace')).toBeInTheDocument()
      expect(screen.getByText('Ägare')).toBeInTheDocument()
    })

    it('shows loading skeleton while context loads', () => {
      vi.mocked(useWorkspace).mockReturnValue({
        ...mockWorkspaceContext,
        isLoading: true,
      } as ReturnType<typeof useWorkspace>)

      render(<WorkspaceSwitcher />)

      // Should show skeleton, not workspace name
      expect(screen.queryByText('Test Workspace')).not.toBeInTheDocument()
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('displays workspace initial as avatar fallback', () => {
      render(<WorkspaceSwitcher />)

      // The fallback shows the first letter of workspace name
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('shows auditor badge when role is AUDITOR', () => {
      vi.mocked(useWorkspace).mockReturnValue({
        ...mockWorkspaceContext,
        role: 'AUDITOR',
      } as ReturnType<typeof useWorkspace>)

      render(<WorkspaceSwitcher />)

      expect(screen.getByText('Endast läsning')).toBeInTheDocument()
    })
  })

  describe('dropdown content', () => {
    it('shows all workspaces when dropdown opens', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      // Open dropdown
      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Other Workspace')).toBeInTheDocument()
        expect(screen.getByText('Client Workspace')).toBeInTheDocument()
      })
    })

    it('highlights current workspace with check icon', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        // Current workspace should have bg-accent class
        const workspaceButtons = screen.getAllByRole('button')
        const currentWorkspaceButton = workspaceButtons.find((btn) =>
          btn.textContent?.includes('Test Workspace')
        )
        expect(currentWorkspaceButton).toHaveClass('bg-accent')
      })
    })

    it('shows role labels in Swedish', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        // Use getAllByText since role appears in trigger and dropdown
        expect(screen.getAllByText('Ägare').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('Medlem')).toBeInTheDocument()
        expect(screen.getByText('Granskare')).toBeInTheDocument()
      })
    })

    it('shows auditor badge for AUDITOR role workspaces in dropdown', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        // Should show "Endast läsning" badge for Client Workspace (AUDITOR)
        const badges = screen.getAllByText('Endast läsning')
        expect(badges.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows create workspace button', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Skapa ny arbetsplats')).toBeInTheDocument()
      })
    })

    it('shows loading spinner while fetching workspaces', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      // Should show loader
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows empty state when no workspaces', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ workspaces: [] }),
      })

      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Inga arbetsplatser')).toBeInTheDocument()
      })
    })
  })

  describe('workspace switching', () => {
    it('calls switch API on workspace click', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/workspace/list')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ workspaces: mockWorkspaces }),
          })
        }
        if (url.includes('/api/workspace/switch')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                workspace: { id: 'ws_2', name: 'Other Workspace' },
              }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Other Workspace')).toBeInTheDocument()
      })

      // Click on other workspace
      const otherWorkspaceBtn = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Other Workspace'))
      if (otherWorkspaceBtn) {
        await user.click(otherWorkspaceBtn)
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/workspace/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: 'ws_2' }),
        })
      })
    })

    it('refreshes context and router after successful switch', async () => {
      const mockContextRefresh = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useWorkspace).mockReturnValue({
        ...mockWorkspaceContext,
        refresh: mockContextRefresh,
      } as ReturnType<typeof useWorkspace>)

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/workspace/list')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ workspaces: mockWorkspaces }),
          })
        }
        if (url.includes('/api/workspace/switch')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Other Workspace')).toBeInTheDocument()
      })

      const otherWorkspaceBtn = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Other Workspace'))
      if (otherWorkspaceBtn) {
        await user.click(otherWorkspaceBtn)
      }

      await waitFor(() => {
        expect(mockContextRefresh).toHaveBeenCalled()
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('does not call switch API when clicking current workspace', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        // Use getAllByText since name appears in both trigger and dropdown
        expect(
          screen.getAllByText('Test Workspace').length
        ).toBeGreaterThanOrEqual(1)
      })

      // Click on current workspace (first one)
      const currentWorkspaceBtn = screen
        .getAllByRole('button')
        .find(
          (btn) =>
            btn.textContent?.includes('Test Workspace') &&
            btn.textContent?.includes('Ägare')
        )
      if (currentWorkspaceBtn) {
        await user.click(currentWorkspaceBtn)
      }

      // Should only have called /api/workspace/list, not /switch
      const switchCalls = mockFetch.mock.calls.filter((call) =>
        (call[0] as string).includes('/switch')
      )
      expect(switchCalls).toHaveLength(0)
    })

    it('calls onSwitchComplete callback after successful switch', async () => {
      const onSwitchComplete = vi.fn()

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/workspace/list')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ workspaces: mockWorkspaces }),
          })
        }
        if (url.includes('/api/workspace/switch')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const user = userEvent.setup()
      render(<WorkspaceSwitcher onSwitchComplete={onSwitchComplete} />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Other Workspace')).toBeInTheDocument()
      })

      const otherWorkspaceBtn = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Other Workspace'))
      if (otherWorkspaceBtn) {
        await user.click(otherWorkspaceBtn)
      }

      await waitFor(() => {
        expect(onSwitchComplete).toHaveBeenCalled()
      })
    })
  })

  describe('create workspace modal', () => {
    it('opens create workspace modal when create button is clicked', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Skapa ny arbetsplats')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Skapa ny arbetsplats'))

      // Modal should open with dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('closes popover when create button is clicked', async () => {
      const user = userEvent.setup()
      render(<WorkspaceSwitcher />)

      await user.click(screen.getByRole('combobox'))

      await waitFor(() => {
        expect(screen.getByText('Skapa ny arbetsplats')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Skapa ny arbetsplats'))

      // Popover should close (workspace list no longer visible outside dialog)
      await waitFor(() => {
        // The create button in popover should no longer be visible
        // (there might be one in the modal now)
        const popoverContent = document.querySelector(
          '[data-radix-popover-content]'
        )
        expect(popoverContent).not.toBeInTheDocument()
      })
    })
  })
})

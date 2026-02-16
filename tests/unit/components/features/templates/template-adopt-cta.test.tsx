import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock sonner toast
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

// Mock adoptTemplate server action
const mockAdoptTemplate = vi.fn()
vi.mock('@/app/actions/template-adoption', () => ({
  adoptTemplate: (...args: unknown[]) => mockAdoptTemplate(...args),
}))

// Mock WorkspaceSelectorDialog to simplify testing
vi.mock('@/components/features/templates/workspace-selector-dialog', () => ({
  WorkspaceSelectorDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean
    onConfirm: (_id: string) => void
    onOpenChange: (_open: boolean) => void
    workspaces: unknown[]
    currentWorkspaceId: string
  }) =>
    open ? (
      <div data-testid="workspace-dialog">
        <button onClick={() => onConfirm('ws_456')}>Confirm</button>
      </div>
    ) : null,
}))

import { TemplateAdoptCta } from '@/components/features/templates/template-adopt-cta'

const singleWorkspace = [
  { id: 'ws_123', name: 'Test Workspace', slug: 'test-workspace' },
]

const multipleWorkspaces = [
  { id: 'ws_123', name: 'Workspace 1', slug: 'ws-1' },
  { id: 'ws_456', name: 'Workspace 2', slug: 'ws-2' },
]

describe('TemplateAdoptCta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdoptTemplate.mockResolvedValue({
      success: true,
      data: { listId: 'list_1', listName: 'Arbetsmiljö', itemCount: 112 },
    })
  })

  it('renders "Använd denna mall" button', () => {
    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={singleWorkspace}
        currentWorkspaceId="ws_123"
      />
    )

    expect(screen.getByText('Använd denna mall')).toBeInTheDocument()
  })

  it('button is enabled', () => {
    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={singleWorkspace}
        currentWorkspaceId="ws_123"
      />
    )

    const button = screen.getByRole('button', { name: /Använd denna mall/ })
    expect(button).not.toBeDisabled()
  })

  it('calls adoptTemplate on click (single workspace)', async () => {
    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={singleWorkspace}
        currentWorkspaceId="ws_123"
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Använd denna mall/ }))
    })

    expect(mockAdoptTemplate).toHaveBeenCalledWith({
      templateSlug: 'arbetsmiljo',
      workspaceId: undefined,
    })
  })

  it('opens workspace dialog on click (multiple workspaces)', async () => {
    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={multipleWorkspaces}
        currentWorkspaceId="ws_123"
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Använd denna mall/ }))
    })

    expect(screen.getByTestId('workspace-dialog')).toBeInTheDocument()
    expect(mockAdoptTemplate).not.toHaveBeenCalled()
  })

  it('shows success toast and redirects after successful adoption', async () => {
    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={singleWorkspace}
        currentWorkspaceId="ws_123"
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Använd denna mall/ }))
    })

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Mallen 'Arbetsmiljö' har lagts till med 112 dokument"
    )
    expect(mockPush).toHaveBeenCalledWith('/laglistor')
  })

  it('shows error toast on adoption failure', async () => {
    mockAdoptTemplate.mockResolvedValue({
      success: false,
      error: 'Mallen hittades inte',
    })

    render(
      <TemplateAdoptCta
        templateSlug="arbetsmiljo"
        workspaces={singleWorkspace}
        currentWorkspaceId="ws_123"
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Använd denna mall/ }))
    })

    expect(mockToastError).toHaveBeenCalledWith('Mallen hittades inte')
    expect(mockPush).not.toHaveBeenCalled()
  })
})

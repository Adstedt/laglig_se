import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkspaceSelectorDialog } from '@/components/features/templates/workspace-selector-dialog'

const workspaces = [
  { id: 'ws_1', name: 'Workspace Alpha', slug: 'ws-alpha' },
  { id: 'ws_2', name: 'Workspace Beta', slug: 'ws-beta' },
]

describe('WorkspaceSelectorDialog', () => {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open is true', () => {
    render(
      <WorkspaceSelectorDialog
        open={true}
        onOpenChange={onOpenChange}
        workspaces={workspaces}
        currentWorkspaceId="ws_1"
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByText('Välj arbetsyta')).toBeInTheDocument()
  })

  it('does not render dialog content when open is false', () => {
    render(
      <WorkspaceSelectorDialog
        open={false}
        onOpenChange={onOpenChange}
        workspaces={workspaces}
        currentWorkspaceId="ws_1"
        onConfirm={onConfirm}
      />
    )

    expect(screen.queryByText('Välj arbetsyta')).not.toBeInTheDocument()
  })

  it('calls onConfirm with current workspace ID by default', () => {
    render(
      <WorkspaceSelectorDialog
        open={true}
        onOpenChange={onOpenChange}
        workspaces={workspaces}
        currentWorkspaceId="ws_1"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByText('Bekräfta'))
    expect(onConfirm).toHaveBeenCalledWith('ws_1')
  })

  it('calls onOpenChange when cancel is clicked', () => {
    render(
      <WorkspaceSelectorDialog
        open={true}
        onOpenChange={onOpenChange}
        workspaces={workspaces}
        currentWorkspaceId="ws_1"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByText('Avbryt'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

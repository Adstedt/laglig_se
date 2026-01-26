import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskModal } from '@/components/features/tasks/create-task-modal'

// Mock the server actions
vi.mock('@/app/actions/tasks', () => ({
  createTask: vi.fn(),
  getTaskColumns: vi.fn(),
  getWorkspaceMembers: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  createTask,
  getTaskColumns,
  getWorkspaceMembers,
} from '@/app/actions/tasks'
import { toast } from 'sonner'

const mockColumns = [
  {
    id: 'col-1',
    name: 'Att göra',
    color: '#6b7280',
    position: 0,
    is_done: false,
    is_default: true,
    workspace_id: 'ws-1',
    _count: { tasks: 0 },
  },
  {
    id: 'col-2',
    name: 'Pågående',
    color: '#3b82f6',
    position: 1,
    is_done: false,
    is_default: true,
    workspace_id: 'ws-1',
    _count: { tasks: 0 },
  },
]

const mockMembers = [
  {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
  },
  {
    id: 'user-2',
    name: 'Another User',
    email: 'another@example.com',
    avatarUrl: null,
  },
]

const mockCreatedTask = {
  id: 'task-1',
  title: 'Test Task',
  description: null,
  column_id: 'col-1',
  position: 0,
  priority: 'MEDIUM',
  due_date: null,
  assignee_id: null,
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
  completed_at: null,
  workspace_id: 'ws-1',
  column: { id: 'col-1', name: 'Att göra', color: '#6b7280', is_done: false },
  assignee: null,
  creator: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  list_item_links: [],
  _count: { comments: 0 },
}

// Helper to wait for form to load
async function waitForFormToLoad() {
  await waitFor(
    () => {
      expect(
        screen.getByPlaceholderText('Ange uppgiftens titel...')
      ).toBeInTheDocument()
    },
    { timeout: 5000 }
  )
}

describe('CreateTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTaskColumns).mockResolvedValue({
      success: true,
      data: mockColumns,
    })
    vi.mocked(getWorkspaceMembers).mockResolvedValue({
      success: true,
      data: mockMembers,
    })
    vi.mocked(createTask).mockResolvedValue({
      success: true,
      data: mockCreatedTask,
    })
  })

  it('renders modal when open', async () => {
    render(<CreateTaskModal open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('create-task-modal')).toBeInTheDocument()
    })
    expect(screen.getByText('Skapa uppgift')).toBeInTheDocument()
  })

  it('does not render modal when closed', () => {
    render(<CreateTaskModal open={false} onOpenChange={vi.fn()} />)

    expect(screen.queryByTestId('create-task-modal')).not.toBeInTheDocument()
  })

  it('loads columns and members when opened', async () => {
    render(<CreateTaskModal open={true} onOpenChange={vi.fn()} />)

    await waitFor(() => {
      expect(getTaskColumns).toHaveBeenCalled()
      expect(getWorkspaceMembers).toHaveBeenCalled()
    })
  })

  it('shows validation error for short title', async () => {
    const user = userEvent.setup()

    render(<CreateTaskModal open={true} onOpenChange={vi.fn()} />)

    await waitForFormToLoad()

    const titleInput = screen.getByPlaceholderText('Ange uppgiftens titel...')
    await user.type(titleInput, 'AB')

    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText('Titeln måste vara minst 3 tecken')
      ).toBeInTheDocument()
    })

    expect(createTask).not.toHaveBeenCalled()
  })

  it('creates task with valid data', async () => {
    const user = userEvent.setup()
    const onTaskCreated = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <CreateTaskModal
        open={true}
        onOpenChange={onOpenChange}
        onTaskCreated={onTaskCreated}
      />
    )

    await waitForFormToLoad()

    const titleInput = screen.getByPlaceholderText('Ange uppgiftens titel...')
    await user.type(titleInput, 'Test Task Title')

    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Task Title',
          priority: 'MEDIUM',
        })
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Uppgift skapad')
    expect(onTaskCreated).toHaveBeenCalledWith(mockCreatedTask)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps modal open when "Skapa en till" is checked', async () => {
    const user = userEvent.setup()
    const onTaskCreated = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <CreateTaskModal
        open={true}
        onOpenChange={onOpenChange}
        onTaskCreated={onTaskCreated}
      />
    )

    await waitForFormToLoad()

    // Check "Skapa en till"
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    // Fill in title
    const titleInput = screen.getByPlaceholderText('Ange uppgiftens titel...')
    await user.type(titleInput, 'Test Task Title')

    // Submit
    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(createTask).toHaveBeenCalled()
    })

    // Modal should not close
    expect(onOpenChange).not.toHaveBeenCalledWith(false)

    // Title should be cleared for next task
    await waitFor(() => {
      expect(titleInput).toHaveValue('')
    })
  })

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateTaskModal open={true} onOpenChange={onOpenChange} />)

    await waitForFormToLoad()

    const cancelButton = screen.getByRole('button', { name: 'Avbryt' })
    await user.click(cancelButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error toast when task creation fails', async () => {
    vi.mocked(createTask).mockResolvedValue({
      success: false,
      error: 'Server error',
    })
    const user = userEvent.setup()

    render(<CreateTaskModal open={true} onOpenChange={vi.fn()} />)

    await waitForFormToLoad()

    const titleInput = screen.getByPlaceholderText('Ange uppgiftens titel...')
    await user.type(titleInput, 'Test Task Title')

    const submitButton = screen.getByRole('button', { name: 'Skapa' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Kunde inte skapa uppgift', {
        description: 'Server error',
      })
    })
  })
})

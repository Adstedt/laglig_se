/**
 * Story 6.15: Tasks Accordion Unit Tests
 * Tests for navigation, unlink, link dialog, collapsible sections, and task creation
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TasksAccordion } from '@/components/features/document-list/legal-document-modal/tasks-accordion'
import { Accordion } from '@/components/ui/accordion'
import type { TaskProgress } from '@/app/actions/legal-document-modal'

// Mock server actions
vi.mock('@/app/actions/tasks', () => ({
  createTask: vi.fn(),
  getWorkspaceMembers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getTasksForLinking: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

vi.mock('@/app/actions/task-modal', () => ({
  linkListItemToTask: vi.fn(),
  unlinkListItemFromTask: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Import mocked modules
import { createTask, getTasksForLinking } from '@/app/actions/tasks'
import {
  linkListItemToTask,
  unlinkListItemFromTask,
} from '@/app/actions/task-modal'
import { toast } from 'sonner'

// Mock columns data for status dropdown
const mockColumns = [
  {
    id: 'col-1',
    name: 'To Do',
    color: '#3b82f6',
    position: 0,
    is_done: false,
    _count: { tasks: 1 },
  },
  {
    id: 'col-2',
    name: 'In Progress',
    color: '#eab308',
    position: 1,
    is_done: false,
    _count: { tasks: 1 },
  },
  {
    id: 'col-3',
    name: 'Done',
    color: '#22c55e',
    position: 2,
    is_done: true,
    _count: { tasks: 1 },
  },
]

// Wrap component with Accordion since TasksAccordion is an AccordionItem
function renderTasksAccordion(
  props: Partial<Parameters<typeof TasksAccordion>[0]> = {}
) {
  const defaultProps = {
    taskProgress: null as TaskProgress | null,
    listItemId: 'test-list-item-123',
    onTasksUpdate: vi.fn().mockResolvedValue(undefined),
    onOpenTask: vi.fn(),
    currentUserId: 'test-user-123',
    columns: mockColumns,
  }

  return render(
    <Accordion type="multiple" defaultValue={['tasks']}>
      <TasksAccordion {...defaultProps} {...props} />
    </Accordion>
  )
}

describe('TasksAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty State', () => {
    it('renders accordion header with Uppgifter', () => {
      renderTasksAccordion()
      expect(screen.getByText('Uppgifter')).toBeInTheDocument()
    })

    it('shows empty state messages when no tasks', () => {
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })
      expect(screen.getByText('Inga länkade uppgifter')).toBeInTheDocument()
    })

    it('shows action buttons when accordion is expanded', () => {
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })
      expect(
        screen.getByRole('button', { name: /ny uppgift/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /länka befintlig/i })
      ).toBeInTheDocument()
    })
  })

  describe('Task Display', () => {
    const taskProgressWithTasks: TaskProgress = {
      completed: 1,
      total: 3,
      tasks: [
        {
          id: 'task-1',
          title: 'Active task 1',
          columnId: 'col-1',
          columnName: 'To Do',
          columnColor: '#3b82f6',
          isDone: false,
          assignee: null,
        },
        {
          id: 'task-2',
          title: 'Active task 2',
          columnId: 'col-2',
          columnName: 'In Progress',
          columnColor: '#eab308',
          isDone: false,
          assignee: null,
        },
        {
          id: 'task-3',
          title: 'Completed task',
          columnId: 'col-3',
          columnName: 'Done',
          columnColor: '#22c55e',
          isDone: true,
          assignee: null,
        },
      ],
    }

    it('displays progress indicator with task count', () => {
      renderTasksAccordion({ taskProgress: taskProgressWithTasks })
      expect(screen.getByText('1/3')).toBeInTheDocument()
    })

    it('renders tasks grouped by column', () => {
      renderTasksAccordion({ taskProgress: taskProgressWithTasks })
      expect(screen.getByText('Active task 1')).toBeInTheDocument()
      expect(screen.getByText('Active task 2')).toBeInTheDocument()
    })

    it('shows completed tasks in Done section', () => {
      renderTasksAccordion({ taskProgress: taskProgressWithTasks })
      // Done section should be collapsed by default, expand it
      fireEvent.click(screen.getByText(/Done/))
      const completedTask = screen.getByText('Completed task')
      expect(completedTask).toBeInTheDocument()
    })

    it('displays column sections with counts', () => {
      renderTasksAccordion({ taskProgress: taskProgressWithTasks })
      // Check that section headers exist (use getAllByRole to handle multiple matches)
      const sectionButtons = screen.getAllByRole('button')
      const sectionNames = sectionButtons.map((btn) => btn.textContent)
      expect(sectionNames.some((name) => name?.includes('To Do'))).toBe(true)
      expect(sectionNames.some((name) => name?.includes('In Progress'))).toBe(
        true
      )
      expect(sectionNames.some((name) => name?.includes('Done'))).toBe(true)
    })
  })

  describe('Navigation', () => {
    const taskProgress: TaskProgress = {
      completed: 0,
      total: 1,
      tasks: [
        {
          id: 'task-nav-1',
          title: 'Navigable task',
          columnId: 'col-1',
          columnName: 'To Do',
          columnColor: '#3b82f6',
          isDone: false,
          assignee: null,
        },
      ],
    }

    it('calls onOpenTask when task row is clicked', async () => {
      const onOpenTask = vi.fn()
      renderTasksAccordion({ taskProgress, onOpenTask })

      // The whole row is now clickable
      const taskRow = screen
        .getByText('Navigable task')
        .closest('[role="button"]')
      fireEvent.click(taskRow!)

      expect(onOpenTask).toHaveBeenCalledWith('task-nav-1')
    })

    it('does not call onOpenTask when clicking unlink button', async () => {
      const onOpenTask = vi.fn()
      ;(unlinkListItemFromTask as Mock).mockResolvedValue({ success: true })

      renderTasksAccordion({ taskProgress, onOpenTask })

      // Hover to show unlink button and click it
      const taskRow = screen.getByText('Navigable task').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      fireEvent.click(unlinkButton!)

      await waitFor(() => {
        expect(onOpenTask).not.toHaveBeenCalled()
      })
    })
  })

  describe('Unlink Functionality', () => {
    const taskProgress: TaskProgress = {
      completed: 0,
      total: 1,
      tasks: [
        {
          id: 'task-unlink-1',
          title: 'Task to unlink',
          columnId: 'col-1',
          columnName: 'To Do',
          columnColor: '#3b82f6',
          isDone: false,
          assignee: null,
        },
      ],
    }

    it('shows unlink button on task hover', () => {
      renderTasksAccordion({ taskProgress })

      const taskRow = screen.getByText('Task to unlink').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      expect(unlinkButton).toBeInTheDocument()
      expect(unlinkButton).toHaveClass('opacity-0')
      expect(unlinkButton).toHaveClass('group-hover:opacity-60')
    })

    it('calls unlinkListItemFromTask when X clicked', async () => {
      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      ;(unlinkListItemFromTask as Mock).mockResolvedValue({ success: true })

      renderTasksAccordion({ taskProgress, onTasksUpdate })

      const taskRow = screen.getByText('Task to unlink').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      fireEvent.click(unlinkButton!)

      await waitFor(() => {
        expect(unlinkListItemFromTask).toHaveBeenCalledWith(
          'task-unlink-1',
          'test-list-item-123'
        )
      })
    })

    it('shows success toast after successful unlink', async () => {
      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      ;(unlinkListItemFromTask as Mock).mockResolvedValue({ success: true })

      renderTasksAccordion({ taskProgress, onTasksUpdate })

      const taskRow = screen.getByText('Task to unlink').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      fireEvent.click(unlinkButton!)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Länk borttagen')
      })
    })

    it('shows error toast on unlink failure', async () => {
      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      ;(unlinkListItemFromTask as Mock).mockResolvedValue({
        success: false,
        error: 'Server error',
      })

      renderTasksAccordion({ taskProgress, onTasksUpdate })

      const taskRow = screen.getByText('Task to unlink').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      fireEvent.click(unlinkButton!)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Kunde inte ta bort länk', {
          description: 'Server error',
        })
      })
    })

    it('calls onTasksUpdate after successful unlink', async () => {
      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      ;(unlinkListItemFromTask as Mock).mockResolvedValue({ success: true })

      renderTasksAccordion({ taskProgress, onTasksUpdate })

      const taskRow = screen.getByText('Task to unlink').closest('.group')
      const unlinkButton = taskRow?.querySelector(
        'button[title="Ta bort länk"]'
      )
      fireEvent.click(unlinkButton!)

      await waitFor(() => {
        expect(onTasksUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('Link Existing Dialog', () => {
    it('opens link dialog when "Länka befintlig" clicked', async () => {
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })

      fireEvent.click(screen.getByRole('button', { name: /länka befintlig/i }))

      await waitFor(() => {
        expect(screen.getByText('Länka befintlig uppgift')).toBeInTheDocument()
      })
    })

    it('displays searchable task list in dialog', async () => {
      ;(getTasksForLinking as Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'linkable-task-1',
            title: 'Linkable Task',
            priority: 'MEDIUM',
            column: { name: 'To Do', color: '#3b82f6', is_done: false },
            assignee: null,
          },
        ],
      })

      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })

      fireEvent.click(screen.getByRole('button', { name: /länka befintlig/i }))

      await waitFor(() => {
        expect(screen.getByText('Linkable Task')).toBeInTheDocument()
      })
    })

    it('shows already-linked tasks as disabled with checkmark', async () => {
      ;(getTasksForLinking as Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'already-linked-task',
            title: 'Already Linked',
            priority: 'MEDIUM',
            column: { name: 'To Do', color: '#3b82f6', is_done: false },
            assignee: null,
          },
        ],
      })

      renderTasksAccordion({
        taskProgress: {
          completed: 0,
          total: 1,
          tasks: [
            {
              id: 'already-linked-task',
              title: 'Already Linked',
              columnName: 'To Do',
              columnColor: '#3b82f6',
              isDone: false,
              assignee: null,
            },
          ],
        },
      })

      fireEvent.click(screen.getByRole('button', { name: /länka befintlig/i }))

      await waitFor(() => {
        expect(screen.getByText('Länkad')).toBeInTheDocument()
      })
    })

    it('calls linkListItemToTask when task selected', async () => {
      ;(getTasksForLinking as Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'to-link-task',
            title: 'Task To Link',
            priority: 'MEDIUM',
            column: { name: 'To Do', color: '#3b82f6', is_done: false },
            assignee: null,
          },
        ],
      })
      ;(linkListItemToTask as Mock).mockResolvedValue({ success: true })

      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
        onTasksUpdate,
      })

      fireEvent.click(screen.getByRole('button', { name: /länka befintlig/i }))

      await waitFor(() => {
        expect(screen.getByText('Task To Link')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Task To Link'))

      await waitFor(() => {
        expect(linkListItemToTask).toHaveBeenCalledWith(
          'to-link-task',
          'test-list-item-123'
        )
      })
    })

    it('closes dialog and refreshes list after linking', async () => {
      ;(getTasksForLinking as Mock).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'link-close-task',
            title: 'Link And Close',
            priority: 'MEDIUM',
            column: { name: 'To Do', color: '#3b82f6', is_done: false },
            assignee: null,
          },
        ],
      })
      ;(linkListItemToTask as Mock).mockResolvedValue({ success: true })

      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
        onTasksUpdate,
      })

      fireEvent.click(screen.getByRole('button', { name: /länka befintlig/i }))

      await waitFor(() => {
        expect(screen.getByText('Link And Close')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Link And Close'))

      await waitFor(() => {
        expect(onTasksUpdate).toHaveBeenCalled()
        expect(toast.success).toHaveBeenCalledWith('Uppgift länkad')
      })
    })
  })

  describe('Collapsible Sections', () => {
    const taskProgress: TaskProgress = {
      completed: 1,
      total: 2,
      tasks: [
        {
          id: 'active-1',
          title: 'Active task',
          columnId: 'col-1',
          columnName: 'To Do',
          columnColor: '#3b82f6',
          isDone: false,
          assignee: null,
        },
        {
          id: 'completed-1',
          title: 'Completed task',
          columnId: 'col-3',
          columnName: 'Done',
          columnColor: '#22c55e',
          isDone: true,
          assignee: null,
        },
      ],
    }

    it('non-done column section is expanded by default', () => {
      renderTasksAccordion({ taskProgress })
      expect(screen.getByText('Active task')).toBeInTheDocument()
    })

    it('done column section is collapsed by default', () => {
      renderTasksAccordion({ taskProgress })
      // The completed task should not be in the DOM initially (collapsible removes content)
      expect(screen.queryByText('Completed task')).not.toBeInTheDocument()
    })

    it('expands done section when clicked', async () => {
      renderTasksAccordion({ taskProgress })

      // Click the collapsible trigger for "Done" section
      const doneSection = screen.getByRole('button', { name: /Done/i })
      fireEvent.click(doneSection)

      await waitFor(() => {
        expect(screen.getByText('Completed task')).toBeVisible()
      })
    })

    it('collapses active section when clicked', async () => {
      renderTasksAccordion({ taskProgress })

      // Click the collapsible trigger for "To Do" section
      const toDoSection = screen.getByRole('button', { name: /To Do/i })
      fireEvent.click(toDoSection)

      await waitFor(() => {
        // When collapsed, content is removed from DOM
        expect(screen.queryByText('Active task')).not.toBeInTheDocument()
      })
    })
  })

  describe('Task Creation Form', () => {
    it('shows create form when "Ny uppgift" is clicked', async () => {
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/titel/i)).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText(/ange uppgiftens titel/i)
        ).toBeInTheDocument()
      })
    })

    it('validates minimum title length', async () => {
      ;(createTask as Mock).mockResolvedValue({
        success: true,
        data: { id: 'new-task' },
      })

      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      // Try to submit with short title
      const createButton = screen.getByRole('button', { name: /^skapa$/i })
      expect(createButton).toBeDisabled()

      // Enter valid title
      const input = screen.getByPlaceholderText(/ange uppgiftens titel/i)
      await userEvent.type(input, 'Valid task title')

      expect(createButton).not.toBeDisabled()
    })

    it('calls createTask with linkedListItemIds on submit', async () => {
      ;(createTask as Mock).mockResolvedValue({
        success: true,
        data: { id: 'created-task-id' },
      })

      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
        onTasksUpdate,
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      const input = screen.getByPlaceholderText(/ange uppgiftens titel/i)
      await userEvent.type(input, 'New test task')

      fireEvent.click(screen.getByRole('button', { name: /^skapa$/i }))

      await waitFor(() => {
        expect(createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New test task',
            linkedListItemIds: ['test-list-item-123'],
          })
        )
      })
    })

    it('shows success toast and resets form after creation', async () => {
      ;(createTask as Mock).mockResolvedValue({
        success: true,
        data: { id: 'created-task' },
      })

      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
        onTasksUpdate,
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      const input = screen.getByPlaceholderText(/ange uppgiftens titel/i)
      await userEvent.type(input, 'Task to create')

      fireEvent.click(screen.getByRole('button', { name: /^skapa$/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Uppgift skapad')
        expect(onTasksUpdate).toHaveBeenCalled()
      })
    })

    it('calls onOpenTask when "Skapa och öppna" is clicked', async () => {
      ;(createTask as Mock).mockResolvedValue({
        success: true,
        data: { id: 'open-after-create' },
      })

      const onOpenTask = vi.fn()
      const onTasksUpdate = vi.fn().mockResolvedValue(undefined)
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
        onOpenTask,
        onTasksUpdate,
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      const input = screen.getByPlaceholderText(/ange uppgiftens titel/i)
      await userEvent.type(input, 'Task to open')

      fireEvent.click(screen.getByRole('button', { name: /skapa och öppna/i }))

      await waitFor(() => {
        expect(onOpenTask).toHaveBeenCalledWith('open-after-create')
      })
    })

    it('hides form when cancel is clicked', async () => {
      renderTasksAccordion({
        taskProgress: { completed: 0, total: 0, tasks: [] },
      })

      fireEvent.click(screen.getByRole('button', { name: /ny uppgift/i }))

      expect(
        screen.getByPlaceholderText(/ange uppgiftens titel/i)
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /avbryt/i }))

      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(/ange uppgiftens titel/i)
        ).not.toBeInTheDocument()
      })
    })
  })
})

/**
 * Story 6.5: Tests for ColumnManager component
 * Tests column list rendering, drag-and-drop, inline editing, and CRUD operations.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import { ColumnManager } from '@/components/features/settings/column-manager'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

// Mock server actions
vi.mock('@/app/actions/tasks', async () => {
  const actual = await vi.importActual('@/app/actions/tasks')
  return {
    ...actual,
    createTaskColumn: vi.fn(),
    updateTaskColumn: vi.fn(),
    deleteTaskColumn: vi.fn(),
    reorderTaskColumns: vi.fn(),
  }
})

import {
  createTaskColumn,
  updateTaskColumn,
  deleteTaskColumn,
  reorderTaskColumns,
} from '@/app/actions/tasks'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock data
const mockColumns: TaskColumnWithCount[] = [
  {
    id: 'col_1',
    workspace_id: 'ws_123',
    name: 'Att göra',
    color: '#6b7280',
    position: 0,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 5 },
  },
  {
    id: 'col_2',
    workspace_id: 'ws_123',
    name: 'Pågående',
    color: '#3b82f6',
    position: 1,
    is_default: true,
    is_done: false,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 3 },
  },
  {
    id: 'col_3',
    workspace_id: 'ws_123',
    name: 'Klar',
    color: '#22c55e',
    position: 2,
    is_default: true,
    is_done: true,
    created_at: new Date(),
    updated_at: new Date(),
    _count: { tasks: 10 },
  },
]

const mockCustomColumn: TaskColumnWithCount = {
  id: 'col_4',
  workspace_id: 'ws_123',
  name: 'Granskning',
  color: '#f59e0b',
  position: 3,
  is_default: false,
  is_done: false,
  created_at: new Date(),
  updated_at: new Date(),
  _count: { tasks: 2 },
}

describe('ColumnManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders all columns with their names', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      expect(screen.getByText('Att göra')).toBeInTheDocument()
      expect(screen.getByText('Pågående')).toBeInTheDocument()
      expect(screen.getByText('Klar')).toBeInTheDocument()
    })

    it('shows task count badges for each column', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('shows "Standard" badge for default columns', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      const standardBadges = screen.getAllByText('Standard')
      expect(standardBadges).toHaveLength(3)
    })

    it('shows "Slutförd" badge for is_done columns', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      expect(screen.getByText('Slutförd')).toBeInTheDocument()
    })

    it('shows column count at the bottom', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      expect(screen.getByText('3 av 8 kolumner används')).toBeInTheDocument()
    })

    it('shows "Ny kolumn" button', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      expect(screen.getByRole('button', { name: /ny kolumn/i })).toBeInTheDocument()
    })
  })

  describe('default columns', () => {
    it('does not show delete button for default columns', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      // Default columns should not have delete buttons
      const deleteButtons = screen.queryAllByRole('button', { name: /radera kolumn/i })
      expect(deleteButtons).toHaveLength(0)
    })

    it('shows delete button for custom columns', () => {
      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const deleteButton = screen.getByRole('button', { name: /radera kolumn granskning/i })
      expect(deleteButton).toBeInTheDocument()
    })
  })

  describe('add column dialog', () => {
    it('opens add dialog when clicking "Ny kolumn"', async () => {
      const user = userEvent.setup()
      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByRole('button', { name: /ny kolumn/i }))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Ny kolumn' })).toBeInTheDocument()
      expect(screen.getByLabelText('Kolumnnamn')).toBeInTheDocument()
    })

    it('disables "Ny kolumn" button when max columns reached', () => {
      // Create 8 columns
      const maxColumns = Array.from({ length: 8 }, (_, i) => ({
        ...mockColumns[0],
        id: `col_${i}`,
        name: `Column ${i}`,
        position: i,
      })) as TaskColumnWithCount[]

      render(<ColumnManager initialColumns={maxColumns} />)

      const button = screen.getByRole('button', { name: /ny kolumn/i })
      expect(button).toBeDisabled()
    })

    it('shows max columns message when limit reached', () => {
      const maxColumns = Array.from({ length: 8 }, (_, i) => ({
        ...mockColumns[0],
        id: `col_${i}`,
        name: `Column ${i}`,
        position: i,
      })) as TaskColumnWithCount[]

      render(<ColumnManager initialColumns={maxColumns} />)

      expect(screen.getByText('8 av 8 kolumner används')).toBeInTheDocument()
      expect(screen.getByText(/max antal kolumner nått/i)).toBeInTheDocument()
    })

    it('calls createTaskColumn when form is submitted', async () => {
      const user = userEvent.setup()
      vi.mocked(createTaskColumn).mockResolvedValue({
        success: true,
        data: {
          ...mockCustomColumn,
          id: 'col_new',
          name: 'Ny status',
        },
      })

      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByRole('button', { name: /ny kolumn/i }))
      await user.type(screen.getByLabelText('Kolumnnamn'), 'Ny status')
      await user.click(screen.getByRole('button', { name: /skapa kolumn/i }))

      await waitFor(() => {
        expect(createTaskColumn).toHaveBeenCalledWith('Ny status', '#6b7280')
      })
    })
  })

  describe('delete column dialog', () => {
    it('opens delete confirmation when clicking delete', async () => {
      const user = userEvent.setup()
      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const deleteButton = screen.getByRole('button', { name: /radera kolumn granskning/i })
      await user.click(deleteButton)

      expect(screen.getByText('Radera kolumn?')).toBeInTheDocument()
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('shows task count in delete confirmation', async () => {
      const user = userEvent.setup()
      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const deleteButton = screen.getByRole('button', { name: /radera kolumn granskning/i })
      await user.click(deleteButton)

      // Check for the dialog content
      const dialog = screen.getByRole('alertdialog')
      expect(dialog).toBeInTheDocument()
      expect(screen.getByText(/uppgifter flyttas till/i)).toBeInTheDocument()
    })

    it('calls deleteTaskColumn when confirmed', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteTaskColumn).mockResolvedValue({
        success: true,
        data: { deletedId: 'col_4', migratedCount: 2 },
      })

      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const deleteButton = screen.getByRole('button', { name: /radera kolumn granskning/i })
      await user.click(deleteButton)
      await user.click(screen.getByRole('button', { name: /^radera$/i }))

      await waitFor(() => {
        expect(deleteTaskColumn).toHaveBeenCalledWith('col_4')
      })
    })
  })

  describe('inline editing', () => {
    it('enters edit mode when clicking column name', async () => {
      const user = userEvent.setup()
      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByText('Att göra'))

      expect(screen.getByDisplayValue('Att göra')).toBeInTheDocument()
    })

    it('calls updateTaskColumn when editing is saved', async () => {
      const user = userEvent.setup()
      vi.mocked(updateTaskColumn).mockResolvedValue({
        success: true,
        data: { ...mockColumns[0], name: 'Ny uppgift' },
      })

      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByText('Att göra'))
      const input = screen.getByDisplayValue('Att göra')
      await user.clear(input)
      await user.type(input, 'Ny uppgift')
      fireEvent.blur(input)

      await waitFor(() => {
        expect(updateTaskColumn).toHaveBeenCalledWith('col_1', { name: 'Ny uppgift' })
      })
    })

    it('cancels editing on Escape key', async () => {
      const user = userEvent.setup()
      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByText('Att göra'))
      const input = screen.getByDisplayValue('Att göra')
      await user.clear(input)
      await user.type(input, 'Changed name')
      await user.keyboard('{Escape}')

      // Should revert to button with original name
      expect(screen.getByText('Att göra')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Changed name')).not.toBeInTheDocument()
    })
  })

  describe('color picker', () => {
    it('shows color buttons for each column', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      const colorButtons = screen.getAllByRole('button', { name: /välj färg/i })
      expect(colorButtons).toHaveLength(3)
    })
  })

  describe('is_done toggle', () => {
    it('does not show toggle for default columns', () => {
      render(<ColumnManager initialColumns={mockColumns} />)

      // Check for switches - default columns should not have toggles
      const switches = screen.queryAllByRole('switch')
      expect(switches).toHaveLength(0)
    })

    it('shows toggle for custom columns', () => {
      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const switches = screen.getAllByRole('switch')
      expect(switches).toHaveLength(1)
    })

    it('calls updateTaskColumn when toggle is changed', async () => {
      const user = userEvent.setup()
      vi.mocked(updateTaskColumn).mockResolvedValue({
        success: true,
        data: { ...mockCustomColumn, is_done: true },
      })

      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      await waitFor(() => {
        expect(updateTaskColumn).toHaveBeenCalledWith('col_4', { is_done: true })
      })
    })
  })

  describe('error handling', () => {
    it('shows error toast when create fails', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      vi.mocked(createTaskColumn).mockResolvedValue({
        success: false,
        error: 'En kolumn med detta namn finns redan',
      })

      render(<ColumnManager initialColumns={mockColumns} />)

      await user.click(screen.getByRole('button', { name: /ny kolumn/i }))
      await user.type(screen.getByLabelText('Kolumnnamn'), 'Att göra')
      await user.click(screen.getByRole('button', { name: /skapa kolumn/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('En kolumn med detta namn finns redan')
      })
    })

    it('shows error toast when delete fails', async () => {
      const user = userEvent.setup()
      const { toast } = await import('sonner')
      vi.mocked(deleteTaskColumn).mockResolvedValue({
        success: false,
        error: 'Standardkolumner kan inte raderas',
      })

      const columnsWithCustom = [...mockColumns, mockCustomColumn]
      render(<ColumnManager initialColumns={columnsWithCustom} />)

      const deleteButton = screen.getByRole('button', { name: /radera kolumn granskning/i })
      await user.click(deleteButton)
      await user.click(screen.getByRole('button', { name: /^radera$/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Standardkolumner kan inte raderas')
      })
    })
  })
})

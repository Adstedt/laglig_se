/**
 * Story 6.19: Task List View Zustand Store
 * Client-side state for column sizing, column visibility, and sorting
 * Persisted via localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ColumnSizingState,
  VisibilityState,
  SortingState,
} from '@tanstack/react-table'

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
  title: 300,
  description: 240,
  columnName: 120,
  assignee: 150,
  dueDate: 140,
  priority: 100,
  createdAt: 100,
}

export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  description: true,
  comments: true,
  assignee: true,
  dueDate: true,
  priority: true,
  createdAt: true,
}

export const DEFAULT_SORTING: SortingState = []

// ============================================================================
// Types
// ============================================================================

export interface TaskListState {
  columnSizing: ColumnSizingState
  columnVisibility: VisibilityState
  sorting: SortingState

  // Actions
  setColumnSizing: (_sizing: ColumnSizingState) => void
  setColumnVisibility: (_visibility: VisibilityState) => void
  resetColumnVisibility: () => void
  setSorting: (_sorting: SortingState) => void
}

// ============================================================================
// Store
// ============================================================================

export const useTaskListStore = create<TaskListState>()(
  persist(
    (set) => ({
      columnSizing: DEFAULT_COLUMN_SIZING,
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      sorting: DEFAULT_SORTING,

      setColumnSizing: (sizing: ColumnSizingState) =>
        set({ columnSizing: sizing }),

      setColumnVisibility: (visibility: VisibilityState) =>
        set({ columnVisibility: visibility }),

      resetColumnVisibility: () =>
        set({ columnVisibility: DEFAULT_COLUMN_VISIBILITY }),

      setSorting: (sorting: SortingState) => set({ sorting }),
    }),
    {
      name: 'task-list-storage',
      partialize: (state) => ({
        columnSizing: state.columnSizing,
        columnVisibility: state.columnVisibility,
        sorting: state.sorting,
      }),
    }
  )
)

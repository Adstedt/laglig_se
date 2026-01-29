/**
 * Story 6.19: Unit Tests for Task List Zustand Store
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useTaskListStore,
  DEFAULT_COLUMN_SIZING,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_SORTING,
} from '@/lib/stores/task-list-store'

describe('Task List Store', () => {
  beforeEach(() => {
    // Reset the store before each test
    useTaskListStore.setState({
      columnSizing: DEFAULT_COLUMN_SIZING,
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      sorting: DEFAULT_SORTING,
    })
  })

  describe('Initial State', () => {
    it('should have correct default column sizing', () => {
      const state = useTaskListStore.getState()
      expect(state.columnSizing).toEqual({
        title: 300,
        description: 240,
        columnName: 120,
        assignee: 150,
        dueDate: 140,
        priority: 100,
        createdAt: 100,
      })
    })

    it('should have correct default column visibility', () => {
      const state = useTaskListStore.getState()
      expect(state.columnVisibility).toEqual({
        description: true,
        comments: true,
        assignee: true,
        dueDate: true,
        priority: true,
        createdAt: true,
      })
    })

    it('should have empty default sorting', () => {
      const state = useTaskListStore.getState()
      expect(state.sorting).toEqual([])
    })
  })

  describe('setColumnSizing', () => {
    it('should update column sizing', () => {
      const newSizing = { title: 400, columnName: 150 }
      useTaskListStore.getState().setColumnSizing(newSizing)

      const state = useTaskListStore.getState()
      expect(state.columnSizing).toEqual(newSizing)
    })

    it('should replace entire sizing object', () => {
      useTaskListStore.getState().setColumnSizing({ title: 500 })

      const state = useTaskListStore.getState()
      expect(state.columnSizing).toEqual({ title: 500 })
      expect(state.columnSizing).not.toHaveProperty('columnName')
    })
  })

  describe('setColumnVisibility', () => {
    it('should update column visibility', () => {
      const newVisibility = { comments: false, assignee: true }
      useTaskListStore.getState().setColumnVisibility(newVisibility)

      const state = useTaskListStore.getState()
      expect(state.columnVisibility).toEqual(newVisibility)
    })

    it('should hide specific columns', () => {
      useTaskListStore.getState().setColumnVisibility({
        ...DEFAULT_COLUMN_VISIBILITY,
        createdAt: false,
        priority: false,
      })

      const state = useTaskListStore.getState()
      expect(state.columnVisibility.createdAt).toBe(false)
      expect(state.columnVisibility.priority).toBe(false)
      expect(state.columnVisibility.comments).toBe(true)
    })
  })

  describe('resetColumnVisibility', () => {
    it('should reset to default visibility', () => {
      // First change visibility
      useTaskListStore.getState().setColumnVisibility({
        comments: false,
        assignee: false,
      })

      // Then reset
      useTaskListStore.getState().resetColumnVisibility()

      const state = useTaskListStore.getState()
      expect(state.columnVisibility).toEqual(DEFAULT_COLUMN_VISIBILITY)
    })
  })

  describe('setSorting', () => {
    it('should set sorting state', () => {
      const newSorting = [{ id: 'title', desc: false }]
      useTaskListStore.getState().setSorting(newSorting)

      const state = useTaskListStore.getState()
      expect(state.sorting).toEqual(newSorting)
    })

    it('should support multiple sort columns', () => {
      const newSorting = [
        { id: 'priority', desc: true },
        { id: 'dueDate', desc: false },
      ]
      useTaskListStore.getState().setSorting(newSorting)

      const state = useTaskListStore.getState()
      expect(state.sorting).toHaveLength(2)
      expect(state.sorting[0]).toEqual({ id: 'priority', desc: true })
    })

    it('should clear sorting with empty array', () => {
      useTaskListStore.getState().setSorting([{ id: 'title', desc: false }])
      useTaskListStore.getState().setSorting([])

      const state = useTaskListStore.getState()
      expect(state.sorting).toEqual([])
    })
  })
})

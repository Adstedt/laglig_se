/**
 * Story 6.19: Unit Tests for Task Filter URL Parameter Utilities
 */

import { describe, it, expect } from 'vitest'
import {
  parseTaskFiltersFromUrl,
  serializeTaskFiltersToUrl,
} from '@/lib/utils/task-filter-params'

describe('Task Filter URL Params', () => {
  describe('parseTaskFiltersFromUrl', () => {
    it('should return empty defaults for no params', () => {
      const params = new URLSearchParams()
      const result = parseTaskFiltersFromUrl(params)

      expect(result).toEqual({
        searchQuery: '',
        statusFilter: [],
        priorityFilter: [],
        assigneeFilter: null,
        dueDateFilter: null,
      })
    })

    it('should parse search query', () => {
      const params = new URLSearchParams('q=test%20query')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.searchQuery).toBe('test query')
    })

    it('should parse single status filter', () => {
      const params = new URLSearchParams('status=Att%20göra')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.statusFilter).toEqual(['Att göra'])
    })

    it('should parse multiple status filters', () => {
      const params = new URLSearchParams('status=Att%20göra,Pågående,Klar')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.statusFilter).toEqual(['Att göra', 'Pågående', 'Klar'])
    })

    it('should parse priority filters', () => {
      const params = new URLSearchParams('priority=HIGH,CRITICAL')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.priorityFilter).toEqual(['HIGH', 'CRITICAL'])
    })

    it('should parse assignee filter', () => {
      const params = new URLSearchParams('assignee=user-123')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.assigneeFilter).toBe('user-123')
    })

    it('should parse unassigned filter', () => {
      const params = new URLSearchParams('assignee=unassigned')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.assigneeFilter).toBe('unassigned')
    })

    it('should parse due date preset', () => {
      const params = new URLSearchParams('dueDate=overdue')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.dueDateFilter).toBe('overdue')
    })

    it('should parse all valid due date presets', () => {
      const presets = ['overdue', 'today', 'thisWeek', 'thisMonth', 'noDueDate']
      for (const preset of presets) {
        const params = new URLSearchParams(`dueDate=${preset}`)
        const result = parseTaskFiltersFromUrl(params)
        expect(result.dueDateFilter).toBe(preset)
      }
    })

    it('should return null for invalid due date preset', () => {
      const params = new URLSearchParams('dueDate=invalid')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.dueDateFilter).toBeNull()
    })

    it('should return null for empty due date param', () => {
      const params = new URLSearchParams('dueDate=')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.dueDateFilter).toBeNull()
    })

    it('should parse all params together', () => {
      const params = new URLSearchParams(
        'q=fix&status=Pågående&priority=HIGH&assignee=user-1&dueDate=thisWeek'
      )
      const result = parseTaskFiltersFromUrl(params)

      expect(result.searchQuery).toBe('fix')
      expect(result.statusFilter).toEqual(['Pågående'])
      expect(result.priorityFilter).toEqual(['HIGH'])
      expect(result.assigneeFilter).toBe('user-1')
      expect(result.dueDateFilter).toBe('thisWeek')
    })

    it('should return null assignee for empty string', () => {
      const params = new URLSearchParams('assignee=')
      const result = parseTaskFiltersFromUrl(params)

      expect(result.assigneeFilter).toBeNull()
    })
  })

  describe('serializeTaskFiltersToUrl', () => {
    it('should produce empty params for default filters', () => {
      const existing = new URLSearchParams()
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        existing
      )

      expect(result.toString()).toBe('')
    })

    it('should serialize search query', () => {
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: 'test',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        new URLSearchParams()
      )

      expect(result.get('q')).toBe('test')
    })

    it('should serialize status filter', () => {
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: ['Att göra', 'Pågående'],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        new URLSearchParams()
      )

      expect(result.get('status')).toBe('Att göra,Pågående')
    })

    it('should serialize priority filter', () => {
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: [],
          priorityFilter: ['HIGH', 'CRITICAL'],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        new URLSearchParams()
      )

      expect(result.get('priority')).toBe('HIGH,CRITICAL')
    })

    it('should serialize assignee filter', () => {
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: 'user-123',
          dueDateFilter: null,
        },
        new URLSearchParams()
      )

      expect(result.get('assignee')).toBe('user-123')
    })

    it('should serialize due date filter', () => {
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: 'overdue',
        },
        new URLSearchParams()
      )

      expect(result.get('dueDate')).toBe('overdue')
    })

    it('should remove params when filters are cleared', () => {
      const existing = new URLSearchParams(
        'q=old&status=Klar&priority=LOW&assignee=user-1&dueDate=overdue'
      )
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: '',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        existing
      )

      expect(result.has('q')).toBe(false)
      expect(result.has('status')).toBe(false)
      expect(result.has('priority')).toBe(false)
      expect(result.has('assignee')).toBe(false)
      expect(result.has('dueDate')).toBe(false)
    })

    it('should preserve existing non-filter params', () => {
      const existing = new URLSearchParams('tab=lista&task=task-123')
      const result = serializeTaskFiltersToUrl(
        {
          searchQuery: 'test',
          statusFilter: [],
          priorityFilter: [],
          assigneeFilter: null,
          dueDateFilter: null,
        },
        existing
      )

      expect(result.get('tab')).toBe('lista')
      expect(result.get('task')).toBe('task-123')
      expect(result.get('q')).toBe('test')
    })

    it('should round-trip correctly', () => {
      const original = {
        searchQuery: 'compliance',
        statusFilter: ['Att göra', 'Pågående'],
        priorityFilter: ['HIGH', 'CRITICAL'],
        assigneeFilter: 'user-42',
        dueDateFilter: 'thisWeek' as const,
      }

      const serialized = serializeTaskFiltersToUrl(
        original,
        new URLSearchParams()
      )
      const parsed = parseTaskFiltersFromUrl(serialized)

      expect(parsed).toEqual(original)
    })

    it('should round-trip with null due date filter', () => {
      const original = {
        searchQuery: '',
        statusFilter: [],
        priorityFilter: [],
        assigneeFilter: null,
        dueDateFilter: null,
      }

      const serialized = serializeTaskFiltersToUrl(
        original,
        new URLSearchParams()
      )
      const parsed = parseTaskFiltersFromUrl(serialized)

      expect(parsed).toEqual(original)
    })
  })
})

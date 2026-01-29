'use client'

/**
 * Story 6.19: Task Filters for Toolbar (Zone B)
 * Status, Priority, and Assignee filters using shared FilterPopover
 */

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { X, User } from 'lucide-react'
import {
  FilterPopover,
  type FilterOption,
} from '@/components/ui/filter-popover'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { WorkspaceMember } from './index'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface TaskFilterState {
  statusFilter: string[]
  priorityFilter: string[]
  assigneeFilter: string | null
}

interface TaskFilterBarProps {
  filters: TaskFilterState
  onFiltersChange: (_filters: TaskFilterState) => void
  columns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
  className?: string
}

// ============================================================================
// Priority Options
// ============================================================================

const PRIORITY_FILTER_OPTIONS: FilterOption[] = [
  { value: 'CRITICAL', label: 'Kritisk', color: 'bg-red-100 text-red-700' },
  { value: 'HIGH', label: 'Hög', color: 'bg-orange-100 text-orange-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'LOW', label: 'Låg', color: 'bg-gray-100 text-gray-700' },
]

// ============================================================================
// Main Component
// ============================================================================

export function TaskFilterBar({
  filters,
  onFiltersChange,
  columns,
  workspaceMembers,
  className,
}: TaskFilterBarProps) {
  const hasActiveFilters =
    filters.statusFilter.length > 0 ||
    filters.priorityFilter.length > 0 ||
    filters.assigneeFilter !== null

  const clearAllFilters = () => {
    onFiltersChange({
      statusFilter: [],
      priorityFilter: [],
      assigneeFilter: null,
    })
  }

  const handleStatusToggle = (columnName: string) => {
    const newStatuses = filters.statusFilter.includes(columnName)
      ? filters.statusFilter.filter((s) => s !== columnName)
      : [...filters.statusFilter, columnName]
    onFiltersChange({ ...filters, statusFilter: newStatuses })
  }

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priorityFilter.includes(priority)
      ? filters.priorityFilter.filter((p) => p !== priority)
      : [...filters.priorityFilter, priority]
    onFiltersChange({ ...filters, priorityFilter: newPriorities })
  }

  const handleAssigneeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      assigneeFilter: value === 'all' ? null : value,
    })
  }

  // Map task columns to FilterOption format with custom rendering
  const statusFilterOptions: FilterOption[] = useMemo(
    () =>
      columns.map((col) => ({
        value: col.name,
        label: col.name,
        color: col.color,
      })),
    [columns]
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Status filter */}
      <FilterPopover
        label="Status"
        options={statusFilterOptions}
        selected={filters.statusFilter}
        onToggle={handleStatusToggle}
        renderOption={(option) => (
          <Badge
            variant="outline"
            className="font-medium"
            style={{
              borderColor: option.color,
              backgroundColor: `${option.color}15`,
              color: option.color,
            }}
          >
            {option.label}
          </Badge>
        )}
      />

      {/* Priority filter */}
      <FilterPopover
        label="Prioritet"
        options={PRIORITY_FILTER_OPTIONS}
        selected={filters.priorityFilter}
        onToggle={handlePriorityToggle}
      />

      {/* Assignee filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Ansvarig:</span>
        <Select
          value={filters.assigneeFilter ?? 'all'}
          onValueChange={handleAssigneeChange}
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="Alla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
                <span>Alla</span>
              </div>
            </SelectItem>
            <SelectItem value="unassigned">Otilldelade</SelectItem>
            {workspaceMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(member.name ?? member.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {member.name ?? member.email}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Rensa filter
        </Button>
      )}
    </div>
  )
}

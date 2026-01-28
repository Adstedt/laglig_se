'use client'

/**
 * Story 6.4: Task Filters Component
 * Shared filter bar for task views
 * Updated to match Law Lists filter styling (Popover + Checkbox + colored badges)
 */

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { WorkspaceMember } from './index'

// ============================================================================
// Types
// ============================================================================

interface TaskFiltersProps {
  searchQuery: string
  onSearchChange: (_query: string) => void
  statusFilter: string[]
  onStatusFilterChange: (_statuses: string[]) => void
  priorityFilter: string[]
  onPriorityFilterChange: (_priorities: string[]) => void
  assigneeFilter: string | null
  onAssigneeFilterChange: (_assigneeId: string | null) => void
  columns: TaskColumnWithCount[]
  workspaceMembers: WorkspaceMember[]
}

// ============================================================================
// Priority Config (with colors matching Law Lists pattern)
// ============================================================================

const PRIORITIES = [
  { value: 'CRITICAL', label: 'Kritisk', color: 'bg-red-100 text-red-700' },
  { value: 'HIGH', label: 'Hög', color: 'bg-orange-100 text-orange-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'LOW', label: 'Låg', color: 'bg-gray-100 text-gray-700' },
]

// ============================================================================
// Main Component
// ============================================================================

export function TaskFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  columns,
  workspaceMembers,
}: TaskFiltersProps) {
  const hasActiveFilters =
    statusFilter.length > 0 ||
    priorityFilter.length > 0 ||
    assigneeFilter !== null

  const clearAllFilters = () => {
    onStatusFilterChange([])
    onPriorityFilterChange([])
    onAssigneeFilterChange(null)
  }

  const handleStatusToggle = (columnName: string) => {
    if (statusFilter.includes(columnName)) {
      onStatusFilterChange(statusFilter.filter((s) => s !== columnName))
    } else {
      onStatusFilterChange([...statusFilter, columnName])
    }
  }

  const handlePriorityToggle = (priority: string) => {
    if (priorityFilter.includes(priority)) {
      onPriorityFilterChange(priorityFilter.filter((p) => p !== priority))
    } else {
      onPriorityFilterChange([...priorityFilter, priority])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Sök uppgifter..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-[160px] pl-8 text-sm"
        />
      </div>

      {/* Status filter - Popover with Checkboxes */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Status
            {statusFilter.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {statusFilter.length}
              </Badge>
            )}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={statusFilter.includes(col.name)}
                  onCheckedChange={() => handleStatusToggle(col.name)}
                />
                <Badge
                  variant="outline"
                  className="font-medium"
                  style={{
                    borderColor: col.color,
                    backgroundColor: `${col.color}15`,
                    color: col.color,
                  }}
                >
                  {col.name}
                </Badge>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Priority filter - Popover with Checkboxes */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Prioritet
            {priorityFilter.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {priorityFilter.length}
              </Badge>
            )}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            {PRIORITIES.map((priority) => (
              <label
                key={priority.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={priorityFilter.includes(priority.value)}
                  onCheckedChange={() => handlePriorityToggle(priority.value)}
                />
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    priority.color
                  )}
                >
                  {priority.label}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Assignee filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Ansvarig:</span>
        <Select
          value={assigneeFilter ?? 'all'}
          onValueChange={(value) =>
            onAssigneeFilterChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="Alla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="unassigned">Otilldelade</SelectItem>
            {workspaceMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name ?? member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear filters */}
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

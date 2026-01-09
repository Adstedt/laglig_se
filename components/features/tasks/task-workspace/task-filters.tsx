'use client'

/**
 * Story 6.4: Task Filters Component
 * Shared filter bar for task views
 */

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
// Priority Config
// ============================================================================

const PRIORITIES = [
  { value: 'CRITICAL', label: 'Kritisk' },
  { value: 'HIGH', label: 'Hög' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Låg' },
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Sök uppgifter..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 w-64"
        />
      </div>

      {/* Status filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Status
            {statusFilter.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {statusFilter.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filtrera på status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={statusFilter.includes(col.name)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onStatusFilterChange([...statusFilter, col.name])
                } else {
                  onStatusFilterChange(
                    statusFilter.filter((s) => s !== col.name)
                  )
                }
              }}
            >
              <span
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: col.color }}
              />
              {col.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Prioritet
            {priorityFilter.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {priorityFilter.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filtrera på prioritet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITIES.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority.value}
              checked={priorityFilter.includes(priority.value)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onPriorityFilterChange([...priorityFilter, priority.value])
                } else {
                  onPriorityFilterChange(
                    priorityFilter.filter((p) => p !== priority.value)
                  )
                }
              }}
            >
              {priority.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee filter */}
      <Select
        value={assigneeFilter ?? 'all'}
        onValueChange={(value) =>
          onAssigneeFilterChange(value === 'all' ? null : value)
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Ansvarig" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla ansvariga</SelectItem>
          <SelectItem value="unassigned">Otilldelade</SelectItem>
          {workspaceMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name ?? member.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
          <X className="mr-2 h-4 w-4" />
          Rensa filter
        </Button>
      )}
    </div>
  )
}

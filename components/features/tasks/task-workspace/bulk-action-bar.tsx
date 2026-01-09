'use client'

/**
 * Story 6.4: Task Bulk Action Bar
 * Actions for selected tasks
 */

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, MoveRight, UserPlus, Flag, Trash2 } from 'lucide-react'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { WorkspaceMember } from './index'

// ============================================================================
// Types
// ============================================================================

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkUpdate: (_updates: {
    columnId?: string
    assigneeId?: string | null
    priority?: string
  }) => Promise<void>
  onBulkDelete: () => Promise<void>
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

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
  columns,
  workspaceMembers,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2">
      {/* Selection info */}
      <div className="flex items-center gap-2">
        <span className="font-medium">{selectedCount} valda</span>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Move to column */}
      <div className="flex items-center gap-2">
        <MoveRight className="h-4 w-4 text-muted-foreground" />
        <Select onValueChange={(value) => onBulkUpdate({ columnId: value })}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Flytta till" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assign to */}
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <Select
          onValueChange={(value) =>
            onBulkUpdate({
              assigneeId: value === 'unassigned' ? null : value,
            })
          }
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Tilldela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Otilldelad</SelectItem>
            {workspaceMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name ?? member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Set priority */}
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-muted-foreground" />
        <Select onValueChange={(value) => onBulkUpdate({ priority: value })}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue placeholder="Prioritet" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority.value} value={priority.value}>
                {priority.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      {/* Delete */}
      <Button variant="destructive" size="sm" onClick={onBulkDelete}>
        <Trash2 className="mr-2 h-4 w-4" />
        Ta bort
      </Button>
    </div>
  )
}

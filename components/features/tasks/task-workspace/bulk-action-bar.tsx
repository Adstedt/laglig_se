'use client'

/**
 * Story 6.4 → Story 28.6: Task bulk actions on the shared DataTableBulkBar
 * shell (count/clear/toolbar semantics live there); this file owns only the
 * task-domain actions: move-to-column, assign, priority, delete.
 */

import { Button } from '@/components/ui/button'
import { DataTableBulkBar } from '@/components/ui/data-table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MoveRight, UserPlus, Flag, Trash2 } from 'lucide-react'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { WorkspaceMember } from './index'

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

const PRIORITIES = [
  { value: 'CRITICAL', label: 'Kritisk' },
  { value: 'HIGH', label: 'Hög' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'LOW', label: 'Låg' },
]

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
  columns,
  workspaceMembers,
}: BulkActionBarProps) {
  return (
    <DataTableBulkBar
      selectedCount={selectedCount}
      onClearSelection={onClearSelection}
    >
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
    </DataTableBulkBar>
  )
}

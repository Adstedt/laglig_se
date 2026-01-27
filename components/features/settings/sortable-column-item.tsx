'use client'

/**
 * Story 6.5: Sortable Column Item
 * Individual draggable column row with inline editing, color picker, and actions.
 */

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ColumnColorPicker } from './column-color-picker'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

interface SortableColumnItemProps {
  column: TaskColumnWithCount
  onUpdate: (
    _columnId: string,
    _updates: { name?: string; color?: string; is_done?: boolean }
  ) => void
  onDelete: (_column: TaskColumnWithCount) => void
  isPending?: boolean
  canToggleIsDone?: boolean
}

export function SortableColumnItem({
  column,
  onUpdate,
  onDelete,
  isPending = false,
  canToggleIsDone = true,
}: SortableColumnItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(column.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    setEditedName(column.name)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    const trimmedName = editedName.trim()
    if (trimmedName && trimmedName !== column.name) {
      onUpdate(column.id, { name: trimmedName })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedName(column.name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleColorChange = (color: string) => {
    onUpdate(column.id, { color })
  }

  const handleIsDoneChange = (checked: boolean) => {
    onUpdate(column.id, { is_done: checked })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
        isDragging && 'opacity-50 shadow-lg',
        isPending && 'opacity-70'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Dra för att ändra ordning"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Color picker */}
      <ColumnColorPicker
        color={column.color}
        onColorChange={handleColorChange}
        disabled={isPending}
      />

      {/* Column name (inline editable) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-8"
              maxLength={50}
              disabled={isPending}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleSaveEdit}
              disabled={isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleCancelEdit}
              disabled={isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={handleStartEdit}
            className="text-left font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            disabled={isPending}
          >
            {column.name}
          </button>
        )}
      </div>

      {/* Task count badge */}
      <Badge variant="secondary" className="shrink-0">
        {column._count.tasks}
      </Badge>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {column.is_default && (
          <Badge variant="outline" className="text-xs">
            Standard
          </Badge>
        )}
        {column.is_done && (
          <Badge variant="default" className="text-xs bg-green-600">
            Slutförd
          </Badge>
        )}
      </div>

      {/* Done toggle */}
      {!column.is_default && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id={`is-done-${column.id}`}
                checked={column.is_done}
                onCheckedChange={handleIsDoneChange}
                disabled={isPending || !canToggleIsDone}
                aria-label="Slutförd-kolumn"
              />
              <Label
                htmlFor={`is-done-${column.id}`}
                className="text-xs text-muted-foreground sr-only"
              >
                Slutförd
              </Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Uppgifter i denna kolumn markeras som klara</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Delete button (only for non-default columns) */}
      {!column.is_default && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(column)}
              disabled={isPending}
              aria-label={`Radera kolumn ${column.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Radera kolumn</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

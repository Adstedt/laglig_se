'use client'

/**
 * Story 4.12: Column Visibility Settings Dropdown
 */

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings2 } from 'lucide-react'
import type { VisibilityState } from '@tanstack/react-table'

// Column definitions with Swedish labels
const COLUMN_OPTIONS: { id: string; label: string; defaultVisible: boolean }[] =
  [
    { id: 'type', label: 'Typ', defaultVisible: true },
    { id: 'title', label: 'Dokument', defaultVisible: true },
    { id: 'complianceStatus', label: 'Efterlevnad', defaultVisible: true },
    { id: 'priority', label: 'Prioritet', defaultVisible: true },
    { id: 'dueDate', label: 'Deadline', defaultVisible: true },
    { id: 'assignee', label: 'Tilldelad', defaultVisible: false },
    { id: 'responsiblePerson', label: 'Ansvarig', defaultVisible: false },
    { id: 'taskProgress', label: 'Uppgifter', defaultVisible: false },
    { id: 'lastActivity', label: 'Aktivitet', defaultVisible: false },
    { id: 'notes', label: 'Anteckningar', defaultVisible: false },
    { id: 'group', label: 'Grupp', defaultVisible: false },
    { id: 'addedAt', label: 'Tillagd', defaultVisible: false },
  ]

// Default visibility state
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = COLUMN_OPTIONS.reduce(
  (acc, col) => {
    acc[col.id] = col.defaultVisible
    return acc
  },
  {} as VisibilityState
)

interface ColumnSettingsProps {
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
}

export function ColumnSettings({
  columnVisibility,
  onColumnVisibilityChange,
}: ColumnSettingsProps) {
  const handleToggle = (columnId: string, checked: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: checked,
    })
  }

  const handleResetToDefaults = () => {
    onColumnVisibilityChange(DEFAULT_COLUMN_VISIBILITY)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="mr-2 h-4 w-4" />
          Kolumner
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUMN_OPTIONS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={columnVisibility[column.id] !== false}
            onCheckedChange={(checked) => handleToggle(column.id, checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start font-normal"
          onClick={handleResetToDefaults}
        >
          Återställ standard
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

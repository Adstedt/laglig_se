'use client'

/**
 * Story 6.19: Generic Column Settings Component
 * Reusable column visibility dropdown for any TanStack table
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

export interface ColumnOption {
  id: string
  label: string
  defaultVisible: boolean
  mandatory?: boolean
}

export interface ColumnSettingsProps {
  columnOptions: ColumnOption[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
  /** Width class for the dropdown content (default: 'w-[200px]') */
  contentWidth?: string
}

/** Compute default visibility state from column options */
export function getDefaultVisibility(
  columnOptions: ColumnOption[]
): VisibilityState {
  return columnOptions.reduce((acc, col) => {
    acc[col.id] = col.defaultVisible
    return acc
  }, {} as VisibilityState)
}

export function ColumnSettings({
  columnOptions,
  columnVisibility,
  onColumnVisibilityChange,
  contentWidth = 'w-[200px]',
}: ColumnSettingsProps) {
  const handleToggle = (columnId: string, checked: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: checked,
    })
  }

  const handleResetToDefaults = () => {
    onColumnVisibilityChange(getDefaultVisibility(columnOptions))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="mr-2 h-4 w-4" />
          Kolumner
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentWidth}>
        <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columnOptions.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={columnVisibility[column.id] !== false}
            onCheckedChange={(checked) => handleToggle(column.id, checked)}
            disabled={column.mandatory === true}
            className={column.mandatory === true ? 'opacity-60' : undefined}
          >
            {column.label}
            {column.mandatory && (
              <span className="ml-auto text-xs text-muted-foreground">
                Obligatorisk
              </span>
            )}
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

'use client'

/**
 * Story 6.18: Compliance Column Visibility Settings Dropdown
 * Similar to ColumnSettings but for compliance view with mandatory columns
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
// mandatory: true means the column cannot be hidden
const COMPLIANCE_COLUMN_OPTIONS: {
  id: string
  label: string
  defaultVisible: boolean
  mandatory: boolean
}[] = [
  { id: 'contentType', label: 'Typ', defaultVisible: true, mandatory: true },
  { id: 'title', label: 'Dokument', defaultVisible: true, mandatory: true },
  {
    id: 'businessContext',
    label: 'Hur påverkar denna lag oss?',
    defaultVisible: true,
    mandatory: true,
  },
  {
    id: 'complianceActions',
    label: 'Hur efterlever vi kraven?',
    defaultVisible: true,
    mandatory: true,
  },
  {
    id: 'complianceStatus',
    label: 'Status',
    defaultVisible: true,
    mandatory: false,
  },
  {
    id: 'priority',
    label: 'Prioritet',
    defaultVisible: true,
    mandatory: false,
  },
  {
    id: 'responsiblePerson',
    label: 'Ansvarig',
    defaultVisible: true,
    mandatory: false,
  },
]

// Default visibility state for compliance view
export const DEFAULT_COMPLIANCE_COLUMN_VISIBILITY: VisibilityState =
  COMPLIANCE_COLUMN_OPTIONS.reduce((acc, col) => {
    acc[col.id] = col.defaultVisible
    return acc
  }, {} as VisibilityState)

interface ComplianceColumnSettingsProps {
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
}

export function ComplianceColumnSettings({
  columnVisibility,
  onColumnVisibilityChange,
}: ComplianceColumnSettingsProps) {
  const handleToggle = (columnId: string, checked: boolean) => {
    onColumnVisibilityChange({
      ...columnVisibility,
      [columnId]: checked,
    })
  }

  const handleResetToDefaults = () => {
    onColumnVisibilityChange(DEFAULT_COMPLIANCE_COLUMN_VISIBILITY)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="mr-2 h-4 w-4" />
          Kolumner
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px]">
        <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COMPLIANCE_COLUMN_OPTIONS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={columnVisibility[column.id] !== false}
            onCheckedChange={(checked) => handleToggle(column.id, checked)}
            disabled={column.mandatory}
            className={column.mandatory ? 'opacity-60' : undefined}
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

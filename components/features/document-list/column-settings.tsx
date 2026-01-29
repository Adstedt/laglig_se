'use client'

/**
 * Story 4.12: Column Visibility Settings for Document List
 * Story 6.19: Refactored to thin wrapper around shared ColumnSettings
 */

import {
  ColumnSettings as BaseColumnSettings,
  getDefaultVisibility,
  type ColumnOption,
} from '@/components/ui/column-settings'
import type { VisibilityState } from '@tanstack/react-table'

// Column definitions with Swedish labels
const COLUMN_OPTIONS: ColumnOption[] = [
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
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState =
  getDefaultVisibility(COLUMN_OPTIONS)

interface ColumnSettingsProps {
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
}

export function ColumnSettings({
  columnVisibility,
  onColumnVisibilityChange,
}: ColumnSettingsProps) {
  return (
    <BaseColumnSettings
      columnOptions={COLUMN_OPTIONS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
    />
  )
}

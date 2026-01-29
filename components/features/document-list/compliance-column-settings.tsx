'use client'

/**
 * Story 6.18: Compliance Column Visibility Settings
 * Story 6.19: Refactored to thin wrapper around shared ColumnSettings
 */

import {
  ColumnSettings as BaseColumnSettings,
  getDefaultVisibility,
  type ColumnOption,
} from '@/components/ui/column-settings'
import type { VisibilityState } from '@tanstack/react-table'

// Column definitions with Swedish labels
// mandatory: true means the column cannot be hidden
const COMPLIANCE_COLUMN_OPTIONS: ColumnOption[] = [
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
  },
  {
    id: 'priority',
    label: 'Prioritet',
    defaultVisible: true,
  },
  {
    id: 'responsiblePerson',
    label: 'Ansvarig',
    defaultVisible: true,
  },
]

// Default visibility state for compliance view
export const DEFAULT_COMPLIANCE_COLUMN_VISIBILITY: VisibilityState =
  getDefaultVisibility(COMPLIANCE_COLUMN_OPTIONS)

interface ComplianceColumnSettingsProps {
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
}

export function ComplianceColumnSettings({
  columnVisibility,
  onColumnVisibilityChange,
}: ComplianceColumnSettingsProps) {
  return (
    <BaseColumnSettings
      columnOptions={COMPLIANCE_COLUMN_OPTIONS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      contentWidth="w-[260px]"
    />
  )
}

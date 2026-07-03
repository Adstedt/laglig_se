'use client'

/**
 * View Menu — consolidated dropdown for view mode, columns, and export.
 * Replaces the scattered ViewToggle + ColumnSettings + ExportDropdown.
 * (Group management lives in the standalone "Hantera grupper" toolbar button.)
 */

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  LayoutGrid,
  Table,
  ClipboardList,
  ChevronDown,
  Columns3,
  ChevronsUpDown,
  FileSpreadsheet,
  Library,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ViewMode } from './view-toggle'
import type { ColumnOption } from '@/components/ui/column-settings'
import { COLUMN_OPTIONS } from './column-settings'
import { COMPLIANCE_COLUMN_OPTIONS } from './compliance-column-settings'
import { exportListAsCsv } from '@/lib/utils/export-csv'
import type { VisibilityState } from '@tanstack/react-table'

interface ViewMenuProps {
  viewMode: ViewMode
  onViewModeChange: (_mode: ViewMode) => void
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_v: VisibilityState) => void
  complianceColumnVisibility: VisibilityState
  onComplianceColumnVisibilityChange: (_v: VisibilityState) => void
  hasGroups: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
  listId: string | null
  listName?: string
  exportDisabled: boolean
}

const VIEW_OPTIONS: Array<{
  value: ViewMode
  label: string
  icon: typeof Table
}> = [
  { value: 'compliance', label: 'Efterlevnad', icon: ClipboardList },
  { value: 'table', label: 'Tabellvy', icon: Table },
  { value: 'card', label: 'Kortvy', icon: LayoutGrid },
]

export function ViewMenu({
  viewMode,
  onViewModeChange,
  columnVisibility,
  onColumnVisibilityChange,
  complianceColumnVisibility,
  onComplianceColumnVisibilityChange,
  hasGroups,
  onExpandAll,
  onCollapseAll,
  listId,
  exportDisabled,
}: ViewMenuProps) {
  const [isExporting, setIsExporting] = useState(false)

  const currentViewLabel =
    VIEW_OPTIONS.find((o) => o.value === viewMode)?.label ?? 'Vy'
  const CurrentIcon =
    VIEW_OPTIONS.find((o) => o.value === viewMode)?.icon ?? Table

  // Determine which column options to show based on view mode
  const columnOptions: ColumnOption[] =
    viewMode === 'compliance' ? COMPLIANCE_COLUMN_OPTIONS : COLUMN_OPTIONS
  const activeVisibility =
    viewMode === 'compliance' ? complianceColumnVisibility : columnVisibility
  const activeVisibilityHandler =
    viewMode === 'compliance'
      ? onComplianceColumnVisibilityChange
      : onColumnVisibilityChange

  const handleColumnToggle = useCallback(
    (columnId: string, checked: boolean) => {
      activeVisibilityHandler({
        ...activeVisibility,
        [columnId]: checked,
      })
    },
    [activeVisibility, activeVisibilityHandler]
  )

  const handleExport = useCallback(async () => {
    if (!listId || exportDisabled) return
    setIsExporting(true)
    try {
      await exportListAsCsv(listId)
      toast.success('CSV exporterad')
    } catch {
      toast.error('Export misslyckades')
    } finally {
      setIsExporting(false)
    }
  }, [listId, exportDisabled])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CurrentIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{currentViewLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[220px]">
        {/* View mode */}
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
          Visningsläge
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={viewMode}
          onValueChange={(v) => onViewModeChange(v as ViewMode)}
        >
          {VIEW_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              <opt.icon className="mr-2 h-3.5 w-3.5" />
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {/* Column settings submenu (not shown in card view) */}
        {viewMode !== 'card' && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Columns3 className="mr-2 h-3.5 w-3.5" />
              Kolumner
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[220px]">
              {columnOptions.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={activeVisibility[col.id] !== false}
                  onCheckedChange={(checked) =>
                    handleColumnToggle(col.id, !!checked)
                  }
                  disabled={col.mandatory ?? false}
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.label}
                  {col.mandatory && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Obligatorisk
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Group management moved to the standalone "Hantera grupper"
            toolbar button (ManageLawGroupsPopover). */}

        {/* Expand / collapse (only when groups exist) */}
        {hasGroups && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExpandAll}>
              <ChevronsUpDown className="mr-2 h-3.5 w-3.5" />
              Visa alla grupper
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCollapseAll}>
              <ChevronsUpDown className="mr-2 h-3.5 w-3.5 rotate-90" />
              Dölj alla grupper
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Export */}
        <DropdownMenuItem
          onClick={handleExport}
          disabled={exportDisabled || isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
          )}
          Exportera CSV
        </DropdownMenuItem>

        {/* Templates link */}
        <DropdownMenuItem asChild>
          <Link href="/laglistor/mallar">
            <Library className="mr-2 h-3.5 w-3.5" />
            Utforska mallar
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

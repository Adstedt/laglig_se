'use client'

/**
 * Story 4.12: View Toggle Component
 * Toggle between Card View and Table View for document lists
 */

import { LayoutGrid, Table } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type ViewMode = 'card' | 'table'

interface ViewToggleProps {
  value: ViewMode
  onChange: (_value: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          // Only trigger if a value is selected (prevents deselection)
          if (newValue) {
            onChange(newValue as ViewMode)
          }
        }}
        className="border rounded-md"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="card" aria-label="Kortvy" className="px-3">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Kortvy</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="table"
              aria-label="Tabellvy"
              className="px-3"
            >
              <Table className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Tabellvy</p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  )
}

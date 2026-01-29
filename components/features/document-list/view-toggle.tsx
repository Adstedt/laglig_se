'use client'

/**
 * Story 4.12: View Toggle Component
 * Toggle between Card View, Table View, and Compliance View for document lists
 *
 * Story 6.18: Added Compliance View (Efterlevnad) option
 */

import { LayoutGrid, Table, ClipboardList } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ViewMode = 'card' | 'table' | 'compliance'

interface ViewToggleProps {
  value: ViewMode
  onChange: (_value: ViewMode) => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const getItemStyles = (itemValue: ViewMode) =>
    cn(
      'px-4 !transition-all duration-200 ease-out transform',
      value === itemValue
        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground scale-[1.08] shadow-md ring-1 ring-primary/20'
        : 'hover:scale-105 hover:shadow-sm'
    )

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
            <ToggleGroupItem
              value="card"
              aria-label="Kortvy"
              className={getItemStyles('card')}
            >
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
              className={getItemStyles('table')}
            >
              <Table className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Tabellvy</p>
          </TooltipContent>
        </Tooltip>

        {/* Story 6.18: Compliance (Efterlevnad) view */}
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="compliance"
              aria-label="Efterlevnad"
              className={getItemStyles('compliance')}
            >
              <ClipboardList className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Efterlevnad</p>
          </TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  )
}

'use client'

/**
 * Dumb, context-free sort dropdown. CardView renders it above the card list
 * by default; pages that want it inside their own toolbar row instead
 * (avoiding a stacked third control row) suppress the built-in one via
 * `view.showCardSortMenu: false` and place this next to their search field,
 * typically visibility-gated with a container-query class.
 */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface DataTableSortMenuProps {
  options: Array<{ id: string; label: string }>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  className?: string
}

export function DataTableSortMenu({
  options,
  sorting,
  onSortingChange,
  className,
}: DataTableSortMenuProps) {
  if (options.length === 0) return null
  const current = sorting[0]
  const currentOption = current
    ? options.find((o) => o.id === current.id)
    : undefined

  const toggle = (id: string) => {
    const isCurrent = current?.id === id
    const next: SortingState = [{ id, desc: isCurrent ? !current.desc : false }]
    onSortingChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-1.5 text-xs', className)}
        >
          {current && currentOption ? (
            <>
              {currentOption.label}
              {current.desc ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </>
          ) : (
            <>
              Sortera
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => {
          const sorted = current?.id === option.id
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => toggle(option.id)}
              className="gap-2"
            >
              <span className="flex-1">{option.label}</span>
              {sorted ? (
                current?.desc ? (
                  <ArrowDown className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

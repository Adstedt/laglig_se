'use client'

/**
 * Story 4.11: Document List Switcher
 * Dropdown to switch between document lists
 */

import { Check, ChevronDown, Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DocumentListSwitcherSkeleton } from './document-list-skeleton'
import type { DocumentListSummary } from '@/app/actions/document-list'

interface DocumentListSwitcherProps {
  lists: DocumentListSummary[]
  activeListId: string | null
  onSelectList: (listId: string) => void
  onCreateList: () => void
  isLoading?: boolean
}

export function DocumentListSwitcher({
  lists,
  activeListId,
  onSelectList,
  onCreateList,
  isLoading,
}: DocumentListSwitcherProps) {
  if (isLoading) {
    return <DocumentListSwitcherSkeleton />
  }

  const activeList = lists.find((l) => l.id === activeListId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-auto justify-between min-w-[200px]"
          role="combobox"
        >
          <span className="flex items-center gap-2 truncate">
            {activeList?.isDefault && (
              <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
            <span className="truncate">
              {activeList?.name ?? 'Välj lista'}
            </span>
            {activeList && (
              <span className="text-muted-foreground text-sm">
                ({activeList.itemCount})
              </span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        {lists.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Inga listor ännu
          </div>
        ) : (
          lists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                {list.isDefault && (
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                )}
                <span className="truncate">{list.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {list.itemCount}
                </span>
                {list.id === activeListId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </span>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onCreateList} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Skapa ny lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

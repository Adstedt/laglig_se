'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, CheckSquare, FileText, ListChecks } from 'lucide-react'

export type LinkKind = 'task' | 'listItem' | 'requirement'

interface LinkTargetChooserProps {
  onPick: (_kind: LinkKind) => void
  disabled?: boolean
  triggerLabel?: string
}

export function LinkTargetChooser({
  onPick,
  disabled,
  triggerLabel = 'Länka till',
}: LinkTargetChooserProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7"
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onSelect={() => onPick('task')}
          className="cursor-pointer"
        >
          <CheckSquare className="h-4 w-4 mr-2 text-muted-foreground" />
          Uppgift
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onPick('listItem')}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
          Författningstext
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onPick('requirement')}
          className="cursor-pointer"
        >
          <ListChecks className="h-4 w-4 mr-2 text-muted-foreground" />
          Krav
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

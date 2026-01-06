'use client'

/**
 * Story 4.13: Inline Group Editor for Table View
 * A dropdown to change the group assignment of a document
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Folder, FolderX, Loader2 } from 'lucide-react'
import type { ListGroupSummary } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

// Value for "ungrouped" option
const UNGROUPED_VALUE = '__ungrouped__'

interface GroupEditorProps {
  value: string | null
  groupName: string | null
  groups: ListGroupSummary[]
  onChange: (groupId: string | null) => Promise<boolean>
  className?: string
}

export function GroupEditor({
  value,
  groupName,
  groups,
  onChange,
  className,
}: GroupEditorProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  // Convert null to our special ungrouped value for the select
  const selectValue = value ?? UNGROUPED_VALUE

  const handleChange = async (newValue: string) => {
    const newGroupId = newValue === UNGROUPED_VALUE ? null : newValue
    if (newGroupId === value) return

    setIsUpdating(true)
    await onChange(newGroupId)
    setIsUpdating(false)
  }

  const displayName = groupName ?? 'Ogrupperad'

  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      disabled={isUpdating}
    >
      <SelectTrigger
        className={cn(
          'h-8 w-[140px] border-none bg-transparent shadow-none hover:bg-muted/50 focus:ring-0',
          className
        )}
      >
        {isUpdating ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Sparar...</span>
          </div>
        ) : (
          <SelectValue placeholder="Välj grupp">
            <div className="flex items-center gap-1.5">
              {value ? (
                <Folder className="h-3 w-3 text-primary" />
              ) : (
                <FolderX className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="truncate text-xs">{displayName}</span>
            </div>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {/* Ungrouped option */}
        <SelectItem value={UNGROUPED_VALUE}>
          <div className="flex items-center gap-2">
            <FolderX className="h-4 w-4 text-muted-foreground" />
            <span>Ogrupperad</span>
          </div>
        </SelectItem>

        {/* Group options */}
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              <span className="truncate">{group.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                ({group.itemCount})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

'use client'

/**
 * Story 7.2: Inline group editor for the employee table.
 *
 * Parallel copy of the law-list `GroupEditor`
 * (components/features/document-list/table-cell-editors/group-editor.tsx),
 * typed for `EmployeeGroupSummary` — deliberately NOT importing the law-list
 * component (it is typed to `ListGroupSummary`).
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
import type { EmployeeGroupSummary } from '@/app/actions/employees'
import { cn } from '@/lib/utils'

// Sentinel value for "ungrouped" (null group)
const UNGROUPED_VALUE = '__ungrouped__'

interface EmployeeGroupEditorProps {
  value: string | null
  groupName: string | null
  groups: EmployeeGroupSummary[]
  onChange: (_groupId: string | null) => Promise<boolean>
  className?: string
}

export function EmployeeGroupEditor({
  value,
  groupName,
  groups,
  onChange,
  className,
}: EmployeeGroupEditorProps) {
  const [isUpdating, setIsUpdating] = useState(false)

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
        <SelectItem value={UNGROUPED_VALUE}>
          <div className="flex items-center gap-2">
            <FolderX className="h-4 w-4 text-muted-foreground" />
            <span>Ogrupperad</span>
          </div>
        </SelectItem>

        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              <span className="truncate">{group.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                ({group.employeeCount})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

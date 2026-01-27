'use client'

/**
 * Story 4.13: Group Selector Component
 * Dropdown for selecting a group to assign items to.
 * Used in:
 * - Bulk actions bar (multi-select)
 * - Individual item context menu
 * - Drag-and-drop target
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Folder, FolderX, ChevronDown, Loader2, FolderPlus } from 'lucide-react'
import type { ListGroupSummary } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

// Value for "ungrouped" option
export const UNGROUPED_VALUE = '__ungrouped__'

interface GroupSelectorProps {
  groups: ListGroupSummary[]
  value: string | null
  onChange: (_groupId: string | null) => void
  onManageGroups?: () => void
  disabled?: boolean
  isLoading?: boolean
  className?: string
  placeholder?: string
  /** If true, shows as a dropdown menu instead of a select */
  variant?: 'select' | 'dropdown'
  /** Label for the dropdown trigger button */
  triggerLabel?: string
}

export function GroupSelector({
  groups,
  value,
  onChange,
  onManageGroups,
  disabled = false,
  isLoading = false,
  className,
  placeholder = 'Välj grupp',
  variant = 'select',
  triggerLabel = 'Flytta till grupp',
}: GroupSelectorProps) {
  // Convert null to our special ungrouped value for the select
  const selectValue = value ?? UNGROUPED_VALUE

  const handleChange = (newValue: string) => {
    onChange(newValue === UNGROUPED_VALUE ? null : newValue)
  }

  // Find current group name for display
  const currentGroup = groups.find((g) => g.id === value)
  const displayName = currentGroup?.name ?? 'Ogrupperad'

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isLoading}
            className={cn('gap-2', className)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
            {triggerLabel}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Ungrouped option */}
          <DropdownMenuItem
            onClick={() => handleChange(UNGROUPED_VALUE)}
            className="gap-2"
          >
            <FolderX className="h-4 w-4 text-muted-foreground" />
            <span>Ogrupperad</span>
          </DropdownMenuItem>

          {groups.length > 0 && <DropdownMenuSeparator />}

          {/* Group options */}
          {groups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              onClick={() => handleChange(group.id)}
              className="gap-2"
            >
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{group.name}</span>
              <span className="text-xs text-muted-foreground">
                {group.itemCount}
              </span>
            </DropdownMenuItem>
          ))}

          {/* Manage groups option */}
          {onManageGroups && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onManageGroups} className="gap-2">
                <FolderPlus className="h-4 w-4 text-muted-foreground" />
                <span>Hantera grupper...</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={cn('w-[180px]', className)}>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Laddar...</span>
          </div>
        ) : (
          <SelectValue placeholder={placeholder}>
            <div className="flex items-center gap-2">
              {value ? (
                <Folder className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FolderX className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate">{displayName}</span>
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
              <Folder className="h-4 w-4 text-muted-foreground" />
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

/**
 * Compact group badge for display (not selection)
 * Shows the current group assignment as a small badge
 */
interface GroupBadgeProps {
  groupName: string | null
  className?: string
  onClick?: () => void
}

export function GroupBadge({ groupName, className, onClick }: GroupBadgeProps) {
  const isUngrouped = !groupName

  const content = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
        isUngrouped
          ? 'bg-muted text-muted-foreground'
          : 'bg-primary/10 text-primary',
        onClick && 'cursor-pointer hover:bg-primary/20 transition-colors',
        className
      )}
    >
      {isUngrouped ? (
        <FolderX className="h-3 w-3" />
      ) : (
        <Folder className="h-3 w-3" />
      )}
      <span className="truncate max-w-[100px]">
        {groupName ?? 'Ogrupperad'}
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="focus:outline-none">
        {content}
      </button>
    )
  }

  return content
}

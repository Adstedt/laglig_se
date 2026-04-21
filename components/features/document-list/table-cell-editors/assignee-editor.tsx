'use client'

/**
 * Story 4.12: Inline Assignee Editor for Table View
 * Story 20.1: Added `variant` + `showResetOption` / `onResetToInherited`
 *             for the kravpunkter-checklist consumer (inherited-state
 *             visual + reset-to-parent action). Existing call sites
 *             default to variant='direct' and are unaffected.
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, RotateCcw, User } from 'lucide-react'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

const RESET_VALUE = '__reset_to_inherited__'

interface AssigneeEditorProps {
  value: string | null
  members: WorkspaceMemberOption[]
  onChange: (_value: string | null) => Promise<void>
  /**
   * Story 20.1: visual treatment.
   * - `'direct'` (default): normal avatar trigger.
   * - `'inherited'`: dimmed trigger + Radix Tooltip "Ärvd från lagansvarig".
   */
  variant?: 'direct' | 'inherited'
  /**
   * Story 20.1: show the "Återställ till lagansvarig" option below the
   * "Ej tilldelad" row when the current value is a direct override that
   * the user may want to clear (returning to inherited state).
   */
  showResetOption?: boolean
  /**
   * Story 20.1: called when the user picks the reset option from the
   * dropdown. Caller is responsible for clearing the override (e.g., by
   * calling updateRequirement with responsibleUserId=null) and
   * revalidating any SWR caches.
   */
  onResetToInherited?: () => Promise<void> | void
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

export function AssigneeEditor({
  value,
  members,
  onChange,
  variant = 'direct',
  showResetOption = false,
  onResetToInherited,
}: AssigneeEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentMember = members.find((m) => m.id === value)
  const isInherited = variant === 'inherited'

  const handleChange = async (newValue: string) => {
    if (newValue === RESET_VALUE) {
      if (!onResetToInherited) return
      setIsLoading(true)
      try {
        await onResetToInherited()
      } finally {
        setIsLoading(false)
      }
      return
    }

    const actualValue = newValue === '__unassigned__' ? null : newValue
    if (actualValue === value) return

    setIsLoading(true)
    try {
      await onChange(actualValue)
    } finally {
      setIsLoading(false)
    }
  }

  const trigger = (
    <SelectTrigger
      className={cn(
        'h-9 w-10 border-0 bg-transparent hover:bg-muted/50 focus:ring-0 p-0 justify-center [&>svg]:hidden',
        isLoading && 'opacity-50',
        // Story 20.1: dim + dashed ring when inherited to signal "not a direct override".
        isInherited && 'opacity-70 hover:opacity-100'
      )}
      title={
        isInherited
          ? 'Ärvd från lagansvarig'
          : currentMember?.name || currentMember?.email || 'Ej tilldelad'
      }
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : currentMember ? (
        <Avatar
          className={cn(
            'h-7 w-7',
            isInherited && 'ring-1 ring-dashed ring-muted-foreground/40'
          )}
        >
          <AvatarImage src={currentMember.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
            {getInitials(currentMember.name, currentMember.email)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className={cn(
            'h-7 w-7 rounded-full bg-muted flex items-center justify-center',
            isInherited && 'ring-1 ring-dashed ring-muted-foreground/40'
          )}
        >
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </SelectTrigger>
  )

  return (
    <Select
      value={value ?? '__unassigned__'}
      onValueChange={handleChange}
      disabled={isLoading}
    >
      {isInherited ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{trigger}</span>
            </TooltipTrigger>
            <TooltipContent side="top">Ärvd från lagansvarig</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <SelectContent>
        <SelectItem value="__unassigned__">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">Ej tilldelad</span>
          </div>
        </SelectItem>
        {showResetOption && onResetToInherited && (
          <>
            <SelectSeparator />
            <SelectItem value={RESET_VALUE}>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                  <RotateCcw className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">
                  Återställ till lagansvarig
                </span>
              </div>
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {members.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(member.name, member.email)}
                </AvatarFallback>
              </Avatar>
              <span>{member.name || member.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

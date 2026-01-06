'use client'

/**
 * Story 4.12: Inline Assignee Editor for Table View
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, User } from 'lucide-react'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

interface AssigneeEditorProps {
  value: string | null
  members: WorkspaceMemberOption[]
  onChange: (value: string | null) => Promise<void>
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

export function AssigneeEditor({ value, members, onChange }: AssigneeEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentMember = members.find((m) => m.id === value)

  const handleChange = async (newValue: string) => {
    const actualValue = newValue === '__unassigned__' ? null : newValue
    if (actualValue === value) return

    setIsLoading(true)
    try {
      await onChange(actualValue)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Select
      value={value ?? '__unassigned__'}
      onValueChange={handleChange}
      disabled={isLoading}
    >
      <SelectTrigger
        className={cn(
          'h-8 w-[150px] border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
          isLoading && 'opacity-50'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentMember ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={currentMember.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(currentMember.name, currentMember.email)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">
              {currentMember.name || currentMember.email.split('@')[0]}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Ej tilldelad</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unassigned__">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">Ej tilldelad</span>
          </div>
        </SelectItem>
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

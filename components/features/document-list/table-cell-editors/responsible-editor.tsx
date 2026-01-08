'use client'

/**
 * Story 6.2: Inline Responsible Person Editor for Table View
 * Similar to AssigneeEditor but for compliance responsible (responsible_user_id)
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

interface ResponsibleEditorProps {
  value: string | null
  members: WorkspaceMemberOption[]
  onChange: (_value: string | null) => Promise<void>
  className?: string
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

export function ResponsibleEditor({
  value,
  members,
  onChange,
  className,
}: ResponsibleEditorProps) {
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
          'h-9 w-10 border-0 bg-transparent hover:bg-muted/50 focus:ring-0 p-0 justify-center [&>svg]:hidden',
          isLoading && 'opacity-50',
          className
        )}
        title={currentMember?.name || currentMember?.email || 'Ej tilldelad'}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentMember ? (
          <Avatar className="h-7 w-7">
            <AvatarImage src={currentMember.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
              {getInitials(currentMember.name, currentMember.email)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
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

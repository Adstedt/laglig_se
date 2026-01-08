'use client'

/**
 * Story 6.2: Responsible Person Cell for Table View
 * Display-only cell showing avatar + name for responsible person
 */

import { memo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResponsibleUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface ResponsiblePersonCellProps {
  user: ResponsibleUser | null
  isLoading?: boolean
  showNameOnMobile?: boolean
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

/**
 * ResponsiblePersonCell displays the responsible person for a list item
 * Shows avatar + name, or "Ej tilldelad" if no one is assigned
 */
export const ResponsiblePersonCell = memo(function ResponsiblePersonCell({
  user,
  isLoading = false,
  showNameOnMobile = false,
  className,
}: ResponsiblePersonCellProps) {
  // Loading state
  if (isLoading) {
    return <ResponsiblePersonCellSkeleton />
  }

  // No responsible person assigned
  if (!user) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
        <span
          className={cn(
            'text-sm text-muted-foreground',
            !showNameOnMobile && 'hidden md:inline'
          )}
        >
          Ej tilldelad
        </span>
      </div>
    )
  }

  const displayName = user.name || user.email.split('@')[0]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Avatar className="h-6 w-6">
        <AvatarImage
          src={user.avatarUrl ?? undefined}
          alt={displayName ?? ''}
        />
        <AvatarFallback className="text-[10px]">
          {getInitials(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          'text-sm truncate max-w-[100px]',
          !showNameOnMobile && 'hidden md:inline'
        )}
        title={displayName ?? undefined}
      >
        {displayName}
      </span>
    </div>
  )
})

/**
 * Loading skeleton for ResponsiblePersonCell
 */
export function ResponsiblePersonCellSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-4 w-20 hidden md:block" />
    </div>
  )
}

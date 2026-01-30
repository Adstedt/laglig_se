'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getSafeRedirectUrl } from '@/lib/utils'
import type { WorkspaceRole } from '@prisma/client'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
  status: string
  company_logo?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Administratör',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Granskare',
}

interface WorkspaceSelectorCardsProps {
  workspaces: WorkspaceItem[]
  redirectTo?: string | undefined
}

export function WorkspaceSelectorCards({
  workspaces,
  redirectTo,
}: WorkspaceSelectorCardsProps) {
  const router = useRouter()
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSelect = async (workspace: WorkspaceItem) => {
    setSwitching(workspace.id)

    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id }),
      })

      if (res.ok) {
        const destination = getSafeRedirectUrl(redirectTo)
        router.push(destination)
      }
    } catch (error) {
      console.error('Failed to switch workspace:', error)
      setSwitching(null)
    }
  }

  return (
    <div className="space-y-3">
      {workspaces.map((ws) => {
        const isAuditor = ws.role === 'AUDITOR'
        const isActive = switching === ws.id
        const isDisabled = switching !== null

        return (
          <button
            key={ws.id}
            onClick={() => handleSelect(ws)}
            disabled={isDisabled}
            className={cn(
              'flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors',
              'hover:bg-accent hover:border-accent-foreground/20',
              isActive && 'border-primary bg-accent',
              isDisabled && !isActive && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Avatar className="h-10 w-10 rounded-lg shrink-0">
              {ws.company_logo && (
                <AvatarImage src={ws.company_logo} alt={ws.name} />
              )}
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                {ws.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{ws.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm text-muted-foreground">
                  {ROLE_LABELS[ws.role] || ws.role}
                </span>
                {isAuditor && (
                  <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Endast läsning
                  </span>
                )}
              </div>
            </div>
            {isActive && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}

'use client'

/**
 * Workspace Switcher Component
 * Displays current workspace and allows switching between workspaces.
 * Story 5.9: Full implementation with logo, create modal, auditor badge
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Check, Loader2, Plus } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { CreateWorkspaceModal } from '@/components/features/workspace/create-workspace-modal'
import type { WorkspaceRole } from '@prisma/client'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
  status: string
  company_logo?: string | null
}

interface WorkspaceSwitcherProps {
  /** Callback fired after workspace switch completes (for mobile sheet close) */
  onSwitchComplete?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Administratör',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Granskare',
}

export function WorkspaceSwitcher({
  onSwitchComplete,
}: WorkspaceSwitcherProps) {
  const router = useRouter()
  const {
    workspaceId,
    workspaceName,
    role,
    isLoading: contextLoading,
    refresh,
  } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  // Fetch workspaces when popover opens
  useEffect(() => {
    if (open && workspaces.length === 0) {
      fetchWorkspaces()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchWorkspaces = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/list')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data.workspaces || [])
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (ws: WorkspaceItem) => {
    if (ws.id === workspaceId) {
      setOpen(false)
      return
    }

    setSwitching(ws.id)
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws.id }),
      })

      if (res.ok) {
        setOpen(false)
        // Refresh the workspace context and reload
        await refresh()
        router.refresh()
        onSwitchComplete?.()
      }
    } catch (error) {
      console.error('Failed to switch workspace:', error)
    } finally {
      setSwitching(null)
    }
  }

  const handleCreateWorkspace = () => {
    setOpen(false)
    setCreateModalOpen(true)
  }

  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open)
    if (!open) {
      // Refetch workspaces when modal closes (in case new one was created)
      setWorkspaces([])
    }
  }

  const roleLabel = ROLE_LABELS[role] || role

  // Get workspace initial for avatar fallback
  const getWorkspaceInitial = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  // Check if current role is auditor
  const isAuditor = role === 'AUDITOR'

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Byt arbetsplats"
            className="w-full justify-start gap-3 h-auto p-3"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                {workspaceName ? getWorkspaceInitial(workspaceName) : 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              {contextLoading ? (
                <>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-16 bg-muted animate-pulse rounded mt-1" />
                </>
              ) : (
                <>
                  <p className="text-sm font-medium truncate">
                    {workspaceName || 'Arbetsplats'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground truncate">
                      {roleLabel}
                    </span>
                    {isAuditor && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Endast läsning
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-1" align="start">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Inga arbetsplatser
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {workspaces.map((ws) => {
                const wsIsAuditor = ws.role === 'AUDITOR'
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitch(ws)}
                    disabled={switching !== null}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      ws.id === workspaceId && 'bg-accent',
                      switching === ws.id && 'opacity-50'
                    )}
                  >
                    <Avatar className="h-7 w-7 rounded-lg shrink-0">
                      {ws.company_logo && (
                        <AvatarImage src={ws.company_logo} alt={ws.name} />
                      )}
                      <AvatarFallback className="rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                        {getWorkspaceInitial(ws.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ws.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {ROLE_LABELS[ws.role] || ws.role}
                        </span>
                        {wsIsAuditor && (
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Endast läsning
                          </span>
                        )}
                      </div>
                    </div>
                    {switching === ws.id ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : ws.id === workspaceId ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}

          {/* Divider and Create button */}
          <Separator className="my-1" />
          <button
            onClick={handleCreateWorkspace}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-muted-foreground/50 shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">Skapa ny arbetsplats</span>
          </button>
        </PopoverContent>
      </Popover>

      <CreateWorkspaceModal
        open={createModalOpen}
        onOpenChange={handleCreateModalClose}
      />
    </>
  )
}

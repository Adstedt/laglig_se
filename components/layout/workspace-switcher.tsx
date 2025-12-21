'use client'

/**
 * Workspace Switcher Component
 * Displays current workspace and allows switching between workspaces.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronsUpDown, Check, Loader2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import type { WorkspaceRole } from '@prisma/client'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
  status: string
}

const TIER_LABELS: Record<string, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Admin',
  HR_MANAGER: 'HR',
  MEMBER: 'Medlem',
  AUDITOR: 'Granskare',
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const {
    workspaceId,
    workspaceName,
    role,
    isLoading: contextLoading,
    refresh,
  } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  // Fetch workspaces when popover opens
  useEffect(() => {
    if (open && workspaces.length === 0) {
      fetchWorkspaces()
    }
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
      }
    } catch (error) {
      console.error('Failed to switch workspace:', error)
    } finally {
      setSwitching(null)
    }
  }

  const roleLabel = TIER_LABELS[role] || role

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start gap-3 h-auto p-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
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
                <p className="text-xs text-muted-foreground truncate">
                  {roleLabel}
                </p>
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Inga arbetsplatser
          </p>
        ) : (
          <div className="space-y-0.5">
            {workspaces.map((ws) => (
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
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIER_LABELS[ws.role] || ws.role}
                  </p>
                </div>
                {switching === ws.id ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : ws.id === workspaceId ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : null}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

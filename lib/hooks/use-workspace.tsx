'use client'

/**
 * Story 5.2: Workspace Context Hook
 * Client-side hook for accessing workspace context and role.
 * Uses fail-closed security: loading/error states deny access.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

interface WorkspaceContextValue {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  workspaceStatus: WorkspaceStatus | null
  role: WorkspaceRole
  isLoading: boolean
  error: string | null
  /** Refetch workspace context */
  refresh: () => Promise<void>
}

const defaultContext: WorkspaceContextValue = {
  workspaceId: '',
  workspaceName: '',
  workspaceSlug: '',
  workspaceStatus: null,
  role: 'MEMBER' as WorkspaceRole,
  isLoading: true,
  error: null,
  refresh: async () => {},
}

const WorkspaceContext = createContext<WorkspaceContextValue>(defaultContext)

interface WorkspaceProviderProps {
  children: ReactNode
  /** Optional: redirect path on auth failure. Default: /login */
  loginRedirect?: string
  /** Optional: redirect path when no workspace. Default: /onboarding */
  noWorkspaceRedirect?: string
}

export function WorkspaceProvider({
  children,
  loginRedirect = '/login',
  noWorkspaceRedirect = '/onboarding',
}: WorkspaceProviderProps) {
  const [state, setState] = useState<Omit<WorkspaceContextValue, 'refresh'>>({
    workspaceId: '',
    workspaceName: '',
    workspaceSlug: '',
    workspaceStatus: null,
    role: 'MEMBER' as WorkspaceRole,
    isLoading: true,
    error: null,
  })

  const fetchWorkspace = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const res = await fetch('/api/workspace/context')

      if (res.ok) {
        const data = await res.json()
        setState({
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          workspaceSlug: data.workspaceSlug,
          workspaceStatus: data.workspaceStatus,
          role: data.role,
          isLoading: false,
          error: null,
        })
      } else if (res.status === 401) {
        // Not authenticated - redirect to login
        window.location.href = loginRedirect
      } else if (res.status === 403) {
        const errorData = await res.json().catch(() => ({}))
        if (errorData.code === 'NO_WORKSPACE') {
          // No workspace access - redirect to workspace selection
          window.location.href = noWorkspaceRedirect
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: errorData.message || 'Åtkomst nekad',
          }))
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorData.message || 'Kunde inte hämta workspace-kontext',
        }))
      }
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Nätverksfel vid hämtning av workspace',
      }))
    }
  }

  useEffect(() => {
    fetchWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextValue: WorkspaceContextValue = {
    ...state,
    refresh: fetchWorkspace,
  }

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * Hook to access workspace context.
 * Always check isLoading and error before using the data.
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

/**
 * Hook that throws if workspace is not loaded or has error.
 * Use this when you need guaranteed workspace data.
 * Should be used with an error boundary.
 */
export function useRequiredWorkspace(): Omit<
  WorkspaceContextValue,
  'isLoading' | 'error'
> {
  const context = useWorkspace()

  if (context.isLoading) {
    throw new Error('Workspace is still loading')
  }
  if (context.error) {
    throw new Error(context.error)
  }
  if (!context.workspaceId) {
    throw new Error('No workspace context available')
  }

  return context
}

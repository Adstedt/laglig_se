'use client'

/**
 * Story 5.2: Permission-Gated UI Component
 * Conditionally renders children based on user permissions.
 * Uses fail-closed security: loading/error states hide content.
 */

import { useWorkspace } from '@/hooks/use-workspace'
import { hasPermission, type Permission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@prisma/client'

interface CanProps {
  /** Single permission or array of permissions to check */
  permission: Permission | Permission[]
  /** Content to render when permission is granted */
  children: React.ReactNode
  /** Content to render when permission is denied (default: null) */
  fallback?: React.ReactNode
  /** If true, requires ALL permissions. If false (default), requires ANY */
  requireAll?: boolean
  /** Content to show while loading workspace context (default: null) */
  loading?: React.ReactNode
}

/**
 * Permission-gated component that shows/hides content based on user role.
 *
 * @example
 * ```tsx
 * // Single permission
 * <Can permission="documents:add">
 *   <Button>Lägg till lag</Button>
 * </Can>
 *
 * // Multiple permissions (OR logic - any permission works)
 * <Can permission={['documents:add', 'lists:create']}>
 *   <Button>Hantera lista</Button>
 * </Can>
 *
 * // Multiple permissions (AND logic - all required)
 * <Can permission={['documents:add', 'lists:create']} requireAll>
 *   <Button>Skapa lista med lagar</Button>
 * </Can>
 *
 * // With fallback
 * <Can permission="employees:view" fallback={<LockedBadge />}>
 *   <EmployeeList />
 * </Can>
 * ```
 */
export function Can({
  permission,
  children,
  fallback = null,
  requireAll = false,
  loading = null,
}: CanProps) {
  const { role, isLoading, error } = useWorkspace()

  // While loading, show loading content (default: nothing)
  // This prevents content flash during initial load
  if (isLoading) {
    return <>{loading}</>
  }

  // On error, hide content (fail closed for security)
  // This ensures we never show protected content when we can't verify permissions
  if (error) {
    return <>{fallback}</>
  }

  const permissions = Array.isArray(permission) ? permission : [permission]
  const typedRole = role as WorkspaceRole

  const hasAccess = requireAll
    ? permissions.every((p) => hasPermission(typedRole, p))
    : permissions.some((p) => hasPermission(typedRole, p))

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Inverse of Can - shows content when user LACKS permission.
 * Useful for showing upgrade prompts or alternative content.
 *
 * @example
 * ```tsx
 * <Cannot permission="workspace:billing">
 *   <UpgradePrompt />
 * </Cannot>
 * ```
 */
export function Cannot({
  permission,
  children,
  fallback = null,
  requireAll = false,
  loading = null,
}: CanProps) {
  const { role, isLoading, error } = useWorkspace()

  if (isLoading) {
    return <>{loading}</>
  }

  // On error, show fallback (fail closed)
  if (error) {
    return <>{fallback}</>
  }

  const permissions = Array.isArray(permission) ? permission : [permission]
  const typedRole = role as WorkspaceRole

  const hasAccess = requireAll
    ? permissions.every((p) => hasPermission(typedRole, p))
    : permissions.some((p) => hasPermission(typedRole, p))

  // Inverse logic - show children when user LACKS permission
  if (hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

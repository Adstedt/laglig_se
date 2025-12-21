'use client'

/**
 * Story 5.2: Permission Convenience Hook
 * Provides easy access to permission checks with role context.
 * Uses fail-closed security: loading/error states deny all permissions.
 */

import { useWorkspace } from '@/hooks/use-workspace'
import { hasPermission, type Permission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@prisma/client'

interface PermissionHelpers {
  // Workspace management
  deleteWorkspace: boolean
  manageBilling: boolean
  manageSettings: boolean

  // Member management
  inviteMembers: boolean
  removeMembers: boolean
  changeRoles: boolean

  // List management
  createLists: boolean
  deleteLists: boolean

  // Document management
  addDocuments: boolean
  removeDocuments: boolean

  // Task management
  editTasks: boolean
  acknowledgeChanges: boolean

  // Employee management
  viewEmployees: boolean
  manageEmployees: boolean

  // Activity & AI
  viewActivity: boolean
  useAiChat: boolean

  // General
  read: boolean
}

interface UsePermissionsResult {
  /** Current user's role */
  role: WorkspaceRole
  /** Whether workspace context is still loading */
  isLoading: boolean
  /** Error message if workspace context failed to load */
  error: string | null
  /**
   * Check any permission by name.
   * Returns false while loading or on error (fail closed).
   */
  has: (_permission: Permission) => boolean
  /**
   * Convenience object with boolean flags for common permissions.
   * All return false while loading or on error (fail closed).
   */
  can: PermissionHelpers
}

/**
 * Hook that provides permission checking utilities.
 * Uses fail-closed security pattern.
 *
 * @example
 * ```tsx
 * function BillingTab() {
 *   const { can, isLoading } = usePermissions()
 *
 *   if (isLoading) return <Skeleton />
 *
 *   if (!can.manageBilling) {
 *     return <UpgradePrompt />
 *   }
 *
 *   return <BillingSettings />
 * }
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const { role, isLoading, error } = useWorkspace()
  const typedRole = role as WorkspaceRole

  // Helper that returns false while loading or on error (fail closed)
  const checkPermission = (permission: Permission): boolean => {
    if (isLoading || error) return false
    return hasPermission(typedRole, permission)
  }

  return {
    role: typedRole,
    isLoading,
    error,
    has: checkPermission,
    can: {
      // Workspace management
      deleteWorkspace: checkPermission('workspace:delete'),
      manageBilling: checkPermission('workspace:billing'),
      manageSettings: checkPermission('workspace:settings'),

      // Member management
      inviteMembers: checkPermission('members:invite'),
      removeMembers: checkPermission('members:remove'),
      changeRoles: checkPermission('members:change_role'),

      // List management
      createLists: checkPermission('lists:create'),
      deleteLists: checkPermission('lists:delete'),

      // Document management
      addDocuments: checkPermission('documents:add'),
      removeDocuments: checkPermission('documents:remove'),

      // Task management
      editTasks: checkPermission('tasks:edit'),
      acknowledgeChanges: checkPermission('changes:acknowledge'),

      // Employee management
      viewEmployees: checkPermission('employees:view'),
      manageEmployees: checkPermission('employees:manage'),

      // Activity & AI
      viewActivity: checkPermission('activity:view'),
      useAiChat: checkPermission('ai:chat'),

      // General
      read: checkPermission('read'),
    },
  }
}

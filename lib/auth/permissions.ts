/**
 * Story 5.1: Role-Based Permission Utilities
 * Defines granular permissions mapped to workspace roles.
 * See: docs/stories/in-progress/5.1.workspace-data-model-multi-tenancy.md
 */

import type { WorkspaceRole } from '@prisma/client'

export type Permission =
  | 'workspace:delete'
  | 'workspace:billing'
  | 'members:invite'
  | 'members:remove'
  | 'members:change_role'
  | 'lists:create'
  | 'lists:delete'
  | 'documents:add'
  | 'documents:remove'
  | 'tasks:edit'
  | 'changes:acknowledge'
  | 'employees:view'
  | 'employees:manage'
  | 'read'

/**
 * Role permissions matrix as defined in Story 5.1
 * Maps each role to its allowed permissions
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  OWNER: [
    'workspace:delete',
    'workspace:billing',
    'members:invite',
    'members:remove',
    'members:change_role',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'employees:view',
    'employees:manage',
    'read',
  ],
  ADMIN: [
    'members:invite',
    'members:remove',
    'members:change_role',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'read',
  ],
  HR_MANAGER: [
    'members:invite',
    'members:remove',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'employees:view',
    'employees:manage',
    'read',
  ],
  MEMBER: ['tasks:edit', 'changes:acknowledge', 'read'],
  AUDITOR: ['read'],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: WorkspaceRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: WorkspaceRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// ============================================================================
// Convenience functions for common permission checks
// ============================================================================

export const canDeleteWorkspace = (role: WorkspaceRole) =>
  hasPermission(role, 'workspace:delete')

export const canManageBilling = (role: WorkspaceRole) =>
  hasPermission(role, 'workspace:billing')

export const canInviteMembers = (role: WorkspaceRole) =>
  hasPermission(role, 'members:invite')

export const canRemoveMembers = (role: WorkspaceRole) =>
  hasPermission(role, 'members:remove')

export const canChangeRoles = (role: WorkspaceRole) =>
  hasPermission(role, 'members:change_role')

export const canCreateLists = (role: WorkspaceRole) =>
  hasPermission(role, 'lists:create')

export const canDeleteLists = (role: WorkspaceRole) =>
  hasPermission(role, 'lists:delete')

export const canAddDocuments = (role: WorkspaceRole) =>
  hasPermission(role, 'documents:add')

export const canRemoveDocuments = (role: WorkspaceRole) =>
  hasPermission(role, 'documents:remove')

export const canEditTasks = (role: WorkspaceRole) =>
  hasPermission(role, 'tasks:edit')

export const canAcknowledgeChanges = (role: WorkspaceRole) =>
  hasPermission(role, 'changes:acknowledge')

export const canViewEmployees = (role: WorkspaceRole) =>
  hasPermission(role, 'employees:view')

export const canManageEmployees = (role: WorkspaceRole) =>
  hasPermission(role, 'employees:manage')

// Alias for convenience
export const canManageLists = canCreateLists
export const canManageDocuments = canAddDocuments

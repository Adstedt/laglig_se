/**
 * Story 5.1 + 5.2: Role-Based Permission Utilities
 * Defines granular permissions mapped to workspace roles.
 *
 * Role Permissions Matrix (Story 5.2 source of truth):
 * ┌─────────────────────────────────┬───────┬───────┬────────────┬────────┬─────────┐
 * │ Action                          │ Owner │ Admin │ HR Manager │ Member │ Auditor │
 * ├─────────────────────────────────┼───────┼───────┼────────────┼────────┼─────────┤
 * │ Delete workspace                │  ✓    │       │            │        │         │
 * │ Manage billing/subscription     │  ✓    │       │            │        │         │
 * │ Manage workspace settings       │  ✓    │  ✓    │            │        │         │
 * │ Invite/remove members           │  ✓    │  ✓    │     ✓      │        │         │
 * │ Change member roles             │  ✓    │  ✓    │            │        │         │
 * │ Create/delete law lists         │  ✓    │  ✓    │     ✓      │        │         │
 * │ Add/remove documents            │  ✓    │  ✓    │     ✓      │        │         │
 * │ Edit tasks/compliance status    │  ✓    │  ✓    │     ✓      │   ✓    │         │
 * │ Mark changes as reviewed        │  ✓    │  ✓    │     ✓      │   ✓    │         │
 * │ View employee data              │  ✓    │       │     ✓      │        │         │
 * │ Manage employees                │  ✓    │       │     ✓      │        │         │
 * │ Use AI chat                     │  ✓    │  ✓    │     ✓      │   ✓    │    ✓    │
 * │ View lists/documents/kanban     │  ✓    │  ✓    │     ✓      │   ✓    │    ✓    │
 * │ View activity log               │  ✓    │  ✓    │            │        │    ✓    │
 * └─────────────────────────────────┴───────┴───────┴────────────┴────────┴─────────┘
 *
 * See: docs/stories/in-progress/5.2.user-roles-permissions.md
 */

import type { WorkspaceRole } from '@prisma/client'

export type Permission =
  | 'workspace:delete'
  | 'workspace:billing'
  | 'workspace:settings'
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
  | 'activity:view'
  | 'ai:chat'
  | 'read'

/**
 * Role permissions matrix as defined in Story 5.1 + 5.2
 * Maps each role to its allowed permissions
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  OWNER: [
    'workspace:delete',
    'workspace:billing',
    'workspace:settings',
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
    'activity:view',
    'ai:chat',
    'read',
  ],
  ADMIN: [
    'workspace:settings',
    'members:invite',
    'members:remove',
    'members:change_role',
    'lists:create',
    'lists:delete',
    'documents:add',
    'documents:remove',
    'tasks:edit',
    'changes:acknowledge',
    'activity:view',
    'ai:chat',
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
    'ai:chat',
    'read',
  ],
  MEMBER: ['tasks:edit', 'changes:acknowledge', 'ai:chat', 'read'],
  AUDITOR: ['activity:view', 'ai:chat', 'read'],
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

export const canManageSettings = (role: WorkspaceRole) =>
  hasPermission(role, 'workspace:settings')

export const canViewActivity = (role: WorkspaceRole) =>
  hasPermission(role, 'activity:view')

export const canUseAiChat = (role: WorkspaceRole) =>
  hasPermission(role, 'ai:chat')

// Alias for convenience
export const canManageLists = canCreateLists
export const canManageDocuments = canAddDocuments

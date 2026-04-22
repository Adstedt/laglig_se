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
 * │ Seal compliance audit cycle     │  ✓    │  ✓    │            │        │         │
 * └─────────────────────────────────┴───────┴───────┴────────────┴────────┴─────────┘
 *
 * Note: `audit:seal` grants role-based authority; in addition, the cycle's
 * `lead_auditor_user_id` is treated as an authorised signer at runtime.
 * The runtime lead-auditor override lives in `lib/compliance-audit/authorization.ts`
 * (see `canSealCycle`) — keeping `permissions.ts` DB-free.
 *
 * Story 21.14: `audit:seal` scope added for Epic 21's Lagefterlevnadskontroll module.
 * See also: lib/compliance-audit/authorization.ts for the runtime lead-auditor
 * override check (sealCycle in Story 21.9 will compose both via canSealCycle()).
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
  | 'audit:seal'
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
    'audit:seal',
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
    'audit:seal',
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

/**
 * Story 21.14: role-based authority to seal a compliance audit cycle.
 * Does NOT account for the runtime lead-auditor override (that lives in
 * `lib/compliance-audit/authorization.ts#canSealCycle`). Use this convenience
 * only where a pure role check suffices (e.g., the `usePermissions` hook).
 */
export const canSealAuditCycle = (role: WorkspaceRole) =>
  hasPermission(role, 'audit:seal')

export const canUseAiChat = (role: WorkspaceRole) =>
  hasPermission(role, 'ai:chat')

// Alias for convenience
export const canManageLists = canCreateLists
export const canManageDocuments = canAddDocuments

/**
 * Story 5.1: Unit tests for role-based permissions
 * Tests the hasPermission function and convenience functions.
 */

import { describe, test, expect } from 'vitest'
import {
  hasPermission,
  getPermissions,
  canDeleteWorkspace,
  canManageBilling,
  canInviteMembers,
  canRemoveMembers,
  canChangeRoles,
  canCreateLists,
  canDeleteLists,
  canAddDocuments,
  canRemoveDocuments,
  canEditTasks,
  canAcknowledgeChanges,
  canViewEmployees,
  canManageEmployees,
} from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@prisma/client'

describe('hasPermission', () => {
  describe('OWNER role', () => {
    const role: WorkspaceRole = 'OWNER'

    test('has all permissions', () => {
      expect(hasPermission(role, 'workspace:delete')).toBe(true)
      expect(hasPermission(role, 'workspace:billing')).toBe(true)
      expect(hasPermission(role, 'members:invite')).toBe(true)
      expect(hasPermission(role, 'members:remove')).toBe(true)
      expect(hasPermission(role, 'members:change_role')).toBe(true)
      expect(hasPermission(role, 'lists:create')).toBe(true)
      expect(hasPermission(role, 'lists:delete')).toBe(true)
      expect(hasPermission(role, 'documents:add')).toBe(true)
      expect(hasPermission(role, 'documents:remove')).toBe(true)
      expect(hasPermission(role, 'tasks:edit')).toBe(true)
      expect(hasPermission(role, 'changes:acknowledge')).toBe(true)
      expect(hasPermission(role, 'employees:view')).toBe(true)
      expect(hasPermission(role, 'employees:manage')).toBe(true)
      expect(hasPermission(role, 'read')).toBe(true)
    })
  })

  describe('ADMIN role', () => {
    const role: WorkspaceRole = 'ADMIN'

    test('cannot delete workspace or manage billing', () => {
      expect(hasPermission(role, 'workspace:delete')).toBe(false)
      expect(hasPermission(role, 'workspace:billing')).toBe(false)
    })

    test('can manage members and roles', () => {
      expect(hasPermission(role, 'members:invite')).toBe(true)
      expect(hasPermission(role, 'members:remove')).toBe(true)
      expect(hasPermission(role, 'members:change_role')).toBe(true)
    })

    test('can manage lists and documents', () => {
      expect(hasPermission(role, 'lists:create')).toBe(true)
      expect(hasPermission(role, 'lists:delete')).toBe(true)
      expect(hasPermission(role, 'documents:add')).toBe(true)
      expect(hasPermission(role, 'documents:remove')).toBe(true)
    })

    test('cannot view or manage employees', () => {
      expect(hasPermission(role, 'employees:view')).toBe(false)
      expect(hasPermission(role, 'employees:manage')).toBe(false)
    })

    test('can edit tasks and acknowledge changes', () => {
      expect(hasPermission(role, 'tasks:edit')).toBe(true)
      expect(hasPermission(role, 'changes:acknowledge')).toBe(true)
      expect(hasPermission(role, 'read')).toBe(true)
    })
  })

  describe('HR_MANAGER role', () => {
    const role: WorkspaceRole = 'HR_MANAGER'

    test('can view employees but ADMIN cannot', () => {
      expect(hasPermission(role, 'employees:view')).toBe(true)
      expect(hasPermission('ADMIN', 'employees:view')).toBe(false)
    })

    test('can manage employees', () => {
      expect(hasPermission(role, 'employees:manage')).toBe(true)
    })

    test('can invite but cannot change roles', () => {
      expect(hasPermission(role, 'members:invite')).toBe(true)
      expect(hasPermission(role, 'members:remove')).toBe(true)
      expect(hasPermission(role, 'members:change_role')).toBe(false)
    })

    test('can manage lists and documents', () => {
      expect(hasPermission(role, 'lists:create')).toBe(true)
      expect(hasPermission(role, 'lists:delete')).toBe(true)
      expect(hasPermission(role, 'documents:add')).toBe(true)
      expect(hasPermission(role, 'documents:remove')).toBe(true)
    })

    test('cannot delete workspace or manage billing', () => {
      expect(hasPermission(role, 'workspace:delete')).toBe(false)
      expect(hasPermission(role, 'workspace:billing')).toBe(false)
    })
  })

  describe('MEMBER role', () => {
    const role: WorkspaceRole = 'MEMBER'

    test('can edit tasks but AUDITOR cannot', () => {
      expect(hasPermission(role, 'tasks:edit')).toBe(true)
      expect(hasPermission('AUDITOR', 'tasks:edit')).toBe(false)
    })

    test('can acknowledge changes', () => {
      expect(hasPermission(role, 'changes:acknowledge')).toBe(true)
    })

    test('cannot manage lists, documents, or members', () => {
      expect(hasPermission(role, 'lists:create')).toBe(false)
      expect(hasPermission(role, 'lists:delete')).toBe(false)
      expect(hasPermission(role, 'documents:add')).toBe(false)
      expect(hasPermission(role, 'documents:remove')).toBe(false)
      expect(hasPermission(role, 'members:invite')).toBe(false)
    })

    test('can read', () => {
      expect(hasPermission(role, 'read')).toBe(true)
    })
  })

  describe('AUDITOR role', () => {
    const role: WorkspaceRole = 'AUDITOR'

    test('can only read', () => {
      expect(hasPermission(role, 'read')).toBe(true)
    })

    test('cannot edit tasks or acknowledge changes', () => {
      expect(hasPermission(role, 'tasks:edit')).toBe(false)
      expect(hasPermission(role, 'changes:acknowledge')).toBe(false)
    })

    test('cannot manage anything', () => {
      expect(hasPermission(role, 'workspace:delete')).toBe(false)
      expect(hasPermission(role, 'workspace:billing')).toBe(false)
      expect(hasPermission(role, 'members:invite')).toBe(false)
      expect(hasPermission(role, 'members:remove')).toBe(false)
      expect(hasPermission(role, 'members:change_role')).toBe(false)
      expect(hasPermission(role, 'lists:create')).toBe(false)
      expect(hasPermission(role, 'lists:delete')).toBe(false)
      expect(hasPermission(role, 'documents:add')).toBe(false)
      expect(hasPermission(role, 'documents:remove')).toBe(false)
      expect(hasPermission(role, 'employees:view')).toBe(false)
      expect(hasPermission(role, 'employees:manage')).toBe(false)
    })
  })
})

describe('getPermissions', () => {
  test('returns all permissions for OWNER', () => {
    const permissions = getPermissions('OWNER')
    expect(permissions).toHaveLength(14)
    expect(permissions).toContain('workspace:delete')
    expect(permissions).toContain('employees:manage')
  })

  test('returns limited permissions for AUDITOR', () => {
    const permissions = getPermissions('AUDITOR')
    expect(permissions).toHaveLength(1)
    expect(permissions).toEqual(['read'])
  })
})

describe('convenience functions', () => {
  test('canDeleteWorkspace', () => {
    expect(canDeleteWorkspace('OWNER')).toBe(true)
    expect(canDeleteWorkspace('ADMIN')).toBe(false)
    expect(canDeleteWorkspace('HR_MANAGER')).toBe(false)
    expect(canDeleteWorkspace('MEMBER')).toBe(false)
    expect(canDeleteWorkspace('AUDITOR')).toBe(false)
  })

  test('canManageBilling', () => {
    expect(canManageBilling('OWNER')).toBe(true)
    expect(canManageBilling('ADMIN')).toBe(false)
  })

  test('canInviteMembers', () => {
    expect(canInviteMembers('OWNER')).toBe(true)
    expect(canInviteMembers('ADMIN')).toBe(true)
    expect(canInviteMembers('HR_MANAGER')).toBe(true)
    expect(canInviteMembers('MEMBER')).toBe(false)
    expect(canInviteMembers('AUDITOR')).toBe(false)
  })

  test('canRemoveMembers', () => {
    expect(canRemoveMembers('OWNER')).toBe(true)
    expect(canRemoveMembers('ADMIN')).toBe(true)
    expect(canRemoveMembers('HR_MANAGER')).toBe(true)
    expect(canRemoveMembers('MEMBER')).toBe(false)
  })

  test('canChangeRoles', () => {
    expect(canChangeRoles('OWNER')).toBe(true)
    expect(canChangeRoles('ADMIN')).toBe(true)
    expect(canChangeRoles('HR_MANAGER')).toBe(false)
    expect(canChangeRoles('MEMBER')).toBe(false)
  })

  test('canCreateLists and canDeleteLists', () => {
    expect(canCreateLists('OWNER')).toBe(true)
    expect(canCreateLists('ADMIN')).toBe(true)
    expect(canCreateLists('HR_MANAGER')).toBe(true)
    expect(canCreateLists('MEMBER')).toBe(false)
    expect(canDeleteLists('AUDITOR')).toBe(false)
  })

  test('canAddDocuments and canRemoveDocuments', () => {
    expect(canAddDocuments('OWNER')).toBe(true)
    expect(canAddDocuments('MEMBER')).toBe(false)
    expect(canRemoveDocuments('HR_MANAGER')).toBe(true)
    expect(canRemoveDocuments('AUDITOR')).toBe(false)
  })

  test('canEditTasks', () => {
    expect(canEditTasks('OWNER')).toBe(true)
    expect(canEditTasks('ADMIN')).toBe(true)
    expect(canEditTasks('HR_MANAGER')).toBe(true)
    expect(canEditTasks('MEMBER')).toBe(true)
    expect(canEditTasks('AUDITOR')).toBe(false)
  })

  test('canAcknowledgeChanges', () => {
    expect(canAcknowledgeChanges('MEMBER')).toBe(true)
    expect(canAcknowledgeChanges('AUDITOR')).toBe(false)
  })

  test('canViewEmployees', () => {
    expect(canViewEmployees('OWNER')).toBe(true)
    expect(canViewEmployees('HR_MANAGER')).toBe(true)
    expect(canViewEmployees('ADMIN')).toBe(false)
    expect(canViewEmployees('MEMBER')).toBe(false)
  })

  test('canManageEmployees', () => {
    expect(canManageEmployees('OWNER')).toBe(true)
    expect(canManageEmployees('HR_MANAGER')).toBe(true)
    expect(canManageEmployees('ADMIN')).toBe(false)
    expect(canManageEmployees('MEMBER')).toBe(false)
  })
})

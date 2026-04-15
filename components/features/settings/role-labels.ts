/**
 * Story 5.3: Shared role-label map and assignable-role list.
 * Extracted from team-tab.tsx so API route handlers + email templates
 * can consume the labels without pulling in the client component.
 */

import type { WorkspaceRole } from '@prisma/client'

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Administratör',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Granskare',
}

export const ROLE_COLORS: Record<WorkspaceRole, string> = {
  OWNER:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  HR_MANAGER:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  MEMBER:
    'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
  AUDITOR:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

/**
 * Roles that can be assigned when inviting or changing a member's role.
 * OWNER is excluded because ownership is not directly assignable.
 */
export const ASSIGNABLE_ROLES: readonly WorkspaceRole[] = [
  'ADMIN',
  'HR_MANAGER',
  'MEMBER',
  'AUDITOR',
] as const

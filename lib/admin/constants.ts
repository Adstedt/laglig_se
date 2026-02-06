import type {
  SubscriptionTier,
  WorkspaceRole,
  WorkspaceStatus,
} from '@prisma/client'

export const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausad',
  DELETED: 'Borttagen',
}

export const STATUS_VARIANT: Record<
  WorkspaceStatus,
  'default' | 'secondary' | 'destructive'
> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DELETED: 'destructive',
}

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  TRIAL: 'Trial',
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Admin',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Revisor',
}

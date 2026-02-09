import type {
  SubscriptionTier,
  TemplateItemContentStatus,
  TemplateStatus,
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

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: 'Utkast',
  IN_REVIEW: 'Under granskning',
  PUBLISHED: 'Publicerad',
  ARCHIVED: 'Arkiverad',
}

export const TEMPLATE_STATUS_VARIANT: Record<
  TemplateStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  IN_REVIEW: 'outline',
  PUBLISHED: 'default',
  ARCHIVED: 'destructive',
}

export const CONTENT_STATUS_LABELS: Record<TemplateItemContentStatus, string> =
  {
    STUB: 'Stub',
    AI_GENERATED: 'AI-genererad',
    HUMAN_REVIEWED: 'Granskad',
    APPROVED: 'Godkänd',
  }

export const CONTENT_STATUS_VARIANT: Record<
  TemplateItemContentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  STUB: 'secondary',
  AI_GENERATED: 'default',
  HUMAN_REVIEWED: 'outline',
  APPROVED: 'default',
}

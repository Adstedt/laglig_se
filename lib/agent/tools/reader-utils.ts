/**
 * Story 19.4: shared shaping helpers for the entity-readers (get_law_list_item /
 * get_task / list_linked_artifacts). Enforce the brief's caps + names-not-IDs.
 */

import {
  getStatusBadgeProps,
  getPriorityBadgeProps,
  type PriorityValue,
} from '@/lib/ui/badge-tones'
import type {
  ChangeType,
  ComplianceStatus,
  ImpactLevel,
  WorkspaceDocumentStatus,
} from '@prisma/client'
import { truncateMarkdown } from './utils'

/** Cap a long free-text field to a short, plain-text excerpt (no raw HTML). */
export function shortText(
  value: string | null | undefined,
  maxTokens = 80
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return truncateMarkdown(trimmed, maxTokens)
}

/**
 * Resolve a user to a display name — never emit a raw user id (brief: names, not
 * IDs). Falls back name → email → "Okänd".
 */
export function userName(
  user: { name?: string | null; email?: string | null } | null | undefined
): string {
  return user?.name ?? user?.email ?? 'Okänd'
}

/** Same as `userName` but yields `null` when there is no user at all. */
export function userNameOrNull(
  user: { name?: string | null; email?: string | null } | null | undefined
): string | null {
  if (!user) return null
  return userName(user)
}

/** ISO date string (or null) for a nullable DateTime. */
export function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

// ---------------------------------------------------------------------------
// Enum → canonical Swedish label (Story 19.4 follow-up, CP-001 family)
//
// Readers MUST emit these labels, never the raw Prisma enum. Otherwise the
// agent improvises a label ("Pågående" instead of the product's "Delvis
// uppfylld", or surfaces the raw "(NONE)") — inconsistent with the UI pills.
// Status + priority reuse the single source of truth in `lib/ui/badge-tones`.
// ---------------------------------------------------------------------------

/**
 * Canonical Swedish label for a `ComplianceStatus` (e.g. PAGAENDE → "Delvis
 * uppfylld") — the same label the compliance-status pills render.
 */
export function complianceStatusLabel(
  value: ComplianceStatus | null | undefined
): string | null {
  return value ? getStatusBadgeProps('compliance-status', value).label : null
}

/** Canonical Swedish label for a Priority enum (MEDIUM → "Medel", HIGH → "Hög"). */
export function priorityLabel(
  value: PriorityValue | null | undefined
): string | null {
  return value ? getPriorityBadgeProps(value).label : null
}

/**
 * Swedish label for the `ImpactLevel` enum. Mirrors `IMPACT_LABELS` in
 * `components/features/changes/assessment-resolution.tsx` — duplicated here
 * because that module is `'use client'` and can't be imported server-side.
 * Consolidating both maps into a server-safe location is a logged follow-up.
 */
const IMPACT_LEVEL_LABELS: Record<ImpactLevel, string> = {
  HIGH: 'Hög',
  MEDIUM: 'Medel',
  LOW: 'Låg',
  NONE: 'Ingen',
}

export function impactLevelLabel(
  value: ImpactLevel | null | undefined
): string | null {
  return value ? IMPACT_LEVEL_LABELS[value] : null
}

/**
 * Canonical Swedish label for a `WorkspaceDocumentStatus` (DRAFT → "Utkast",
 * APPROVED → "Godkänd", …). Reuses the single source in `lib/ui/badge-tones`
 * (the `'document-status'` domain). Story 19.3 (list_stale_documents).
 */
export function workspaceDocumentStatusLabel(
  value: WorkspaceDocumentStatus | null | undefined
): string | null {
  return value ? getStatusBadgeProps('document-status', value).label : null
}

/**
 * Swedish label for the `ChangeType` enum (AMENDMENT → "Ändring", REPEAL →
 * "Upphävande", …). Mirrors `CHANGE_TYPE_LABELS` in `assessment-detail.tsx` /
 * `change-row.tsx` — duplicated here because those modules are `'use client'`
 * and can't be imported server-side (same rationale as `IMPACT_LEVEL_LABELS`).
 * Consolidating the enum-label maps into a server-safe location is a logged
 * follow-up.
 */
const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  NEW_LAW: 'Ny lag',
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
  UPCOMING_AMENDMENT: 'Kommande ändring',
}

export function changeTypeLabel(
  value: ChangeType | null | undefined
): string | null {
  return value ? CHANGE_TYPE_LABELS[value] : null
}

/**
 * Story 19.4: shared shaping helpers for the entity-readers (get_law_list_item /
 * get_task / list_linked_artifacts). Enforce the brief's caps + names-not-IDs.
 */

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

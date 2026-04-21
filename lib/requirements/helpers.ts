/**
 * Pure helpers for kravpunkter (LawListItemRequirement) business logic.
 *
 * These functions MUST live outside `app/actions/*` because Next.js 16
 * Turbopack enforces that every export from a file marked `'use server'`
 * is an async function. Keeping `resolveEffectiveAssignee` and
 * `pickContentActionName` here lets the action module import them while
 * keeping the build happy and preserving synchronous call sites.
 *
 * Consumed by:
 *   - `app/actions/law-list-item-requirements.ts` (Story 20.1 CRUD actions)
 *   - `app/actions/workspace-requirements.ts` (Story 20.2 aggregation)
 */

// ============================================================================
// Effective-assignee resolution (Story 20.1)
// ============================================================================

export interface EffectiveAssignee {
  userId: string | null
  isInherited: boolean
}

/**
 * Resolve the effective assignee for a kravpunkt with inheritance from the
 * parent law item. Pure function — callers pass already-loaded objects.
 * Single source of truth for both the modal (getRequirementsForListItem)
 * and the workspace overview (getWorkspaceRequirements, Story 20.2).
 */
export function resolveEffectiveAssignee(
  krav: { responsibleUserId: string | null },
  listItem: { responsibleUserId: string | null }
): EffectiveAssignee {
  if (krav.responsibleUserId !== null) {
    return { userId: krav.responsibleUserId, isInherited: false }
  }
  if (listItem.responsibleUserId !== null) {
    return { userId: listItem.responsibleUserId, isInherited: true }
  }
  return { userId: null, isInherited: false }
}

// ============================================================================
// Content-change activity-log action picker (Story 20.1 QA-fix MNT-001)
// ============================================================================

export type ContentUpdatePatch = {
  text?: string | undefined
  isFulfilled?: boolean | undefined
  bevisRequired?: boolean | undefined
  comment?: string | null | undefined
}

export type ContentUpdateExisting = {
  bevis_required: boolean
  comment: string | null
}

export type RequirementContentActionName =
  | 'requirement_marked_bevis_required'
  | 'requirement_marked_bevis_optional'
  | 'requirement_marked_fulfilled'
  | 'requirement_marked_unfulfilled'
  | 'requirement_comment_updated'
  | 'requirement_text_updated'

/**
 * Pure action-name selector for the content-change branch of `updateRequirement`.
 * Priority:
 *   1. bevis_required flipped → matching bevis action
 *   2. isFulfilled present → matching fulfilled action
 *   3. comment present and changed → comment_updated
 *   4. fallback → text_updated
 * The priority order (and the presence-vs-change asymmetry on isFulfilled)
 * matches the behaviour shipped by Story 17.16; the extraction preserves it
 * exactly so the activity feed remains consistent with prior history.
 */
export function pickContentActionName(
  patch: ContentUpdatePatch,
  existing: ContentUpdateExisting
): RequirementContentActionName {
  if (
    patch.bevisRequired !== undefined &&
    patch.bevisRequired !== existing.bevis_required
  ) {
    return patch.bevisRequired
      ? 'requirement_marked_bevis_required'
      : 'requirement_marked_bevis_optional'
  }
  if (patch.isFulfilled !== undefined) {
    return patch.isFulfilled
      ? 'requirement_marked_fulfilled'
      : 'requirement_marked_unfulfilled'
  }
  if (patch.comment !== undefined && patch.comment !== existing.comment) {
    return 'requirement_comment_updated'
  }
  return 'requirement_text_updated'
}

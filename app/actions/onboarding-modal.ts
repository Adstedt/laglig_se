'use server'

/**
 * Story 25.0 (Epic 25): First-run onboarding modal — server actions.
 *
 * Five workspace-self-write actions backing the path-choice modal. All are
 * wrapped in `withWorkspace(cb)` (no permission scope — a user can only ever
 * touch their own workspace's onboarding state).
 *
 * Fail-safe pattern (mirrors Story 14.27 `[CHAT_USAGE_EVENT_WRITE_FAIL]` and
 * Story 5.12 `[ENTERPRISE_INQUIRY_EMAIL_FAIL]`):
 *  - the PRIMARY `workspace.update` runs first; a failure there returns
 *    `{ ok: false, error }` because that write matters for correctness;
 *  - the SECONDARY `onboardingEvent.create` runs after, wrapped in try/catch,
 *    logged as `[ONBOARDING_EVENT_WRITE_FAIL]`, never re-thrown — telemetry is
 *    best-effort and must never break the user-facing action.
 *
 * `withWorkspace` itself throws `WorkspaceAccessError` for unauthenticated /
 * unauthorised callers; that propagates (it is not converted to `{ok:false}`).
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Best-effort `OnboardingEvent` row write. Never throws — a telemetry failure
 * must not break the user-facing action that triggered it.
 */
async function writeOnboardingEvent(
  workspaceId: string,
  userId: string,
  eventType: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.onboardingEvent.create({
      data: {
        workspace_id: workspaceId,
        user_id: userId,
        event_type: eventType,
        // Conditionally include the key — under exactOptionalPropertyTypes
        // `payload: undefined` is not assignable to Prisma's Json input type.
        ...(payload !== undefined && {
          payload: payload as Prisma.InputJsonValue,
        }),
      },
    })
  } catch (err) {
    console.error('[ONBOARDING_EVENT_WRITE_FAIL]', eventType, err)
  }
}

/**
 * Modal close / minimise. Sets `first_run_dismissed_at = NOW()` so the modal
 * does not auto-open again. Records a `modal_dismissed` event.
 */
export async function minimiseFirstRunModal(): Promise<ActionResult> {
  return withWorkspace(async (ctx) => {
    try {
      await prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: { first_run_dismissed_at: new Date() },
      })
    } catch (err) {
      console.error('[minimiseFirstRunModal]', err)
      return { ok: false, error: 'Kunde inte stänga guiden. Försök igen.' }
    }

    await writeOnboardingEvent(ctx.workspaceId, ctx.userId, 'modal_dismissed', {
      from_state: 'path_choice',
    })
    return { ok: true }
  })
}

/**
 * "Hoppa över — bygg manuellt". Sets BOTH `law_list_generation_status='skipped'`
 * and `first_run_dismissed_at=NOW()` in a single update — the skipped status
 * keeps the modal (and, later, the FAB) permanently closed. Records a
 * `path_chosen` event with `path: 'skipped'`.
 */
export async function skipLawListGeneration(): Promise<ActionResult> {
  return withWorkspace(async (ctx) => {
    try {
      await prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: {
          law_list_generation_status: 'skipped',
          first_run_dismissed_at: new Date(),
        },
      })
    } catch (err) {
      console.error('[skipLawListGeneration]', err)
      return { ok: false, error: 'Något gick fel. Försök igen.' }
    }

    await writeOnboardingEvent(ctx.workspaceId, ctx.userId, 'path_chosen', {
      path: 'skipped',
    })
    return { ok: true }
  })
}

/**
 * Story B.6 stub — corner FAB dismissal. Sets `tutorial_fab_dismissed_at=NOW()`.
 * Shipped in B.0 so the FAB component in B.6 can call a stable contract; no UI
 * wires this in B.0.
 */
export async function dismissOnboardingFab(): Promise<ActionResult> {
  return withWorkspace(async (ctx) => {
    try {
      await prisma.workspace.update({
        where: { id: ctx.workspaceId },
        data: { tutorial_fab_dismissed_at: new Date() },
      })
    } catch (err) {
      console.error('[dismissOnboardingFab]', err)
      return {
        ok: false,
        error: 'Kunde inte dölja guide-knappen. Försök igen.',
      }
    }

    await writeOnboardingEvent(ctx.workspaceId, ctx.userId, 'fab_dismissed', {
      from_state: 'visible_idle',
    })
    return { ok: true }
  })
}

/**
 * Story B.3 stub — records a tutorial tab as viewed. Idempotently appends
 * `tabId` to `Workspace.first_run_tabs_viewed` (a JSON string array). Shipped
 * in B.0 so the tutorial step in B.3 can call a stable contract; no UI wires
 * this in B.0.
 */
export async function recordTabViewed(tabId: string): Promise<ActionResult> {
  return withWorkspace(async (ctx) => {
    try {
      const ws = await prisma.workspace.findUnique({
        where: { id: ctx.workspaceId },
        select: { first_run_tabs_viewed: true },
      })

      // first_run_tabs_viewed is Json? defaulting to []; coerce defensively.
      const current = Array.isArray(ws?.first_run_tabs_viewed)
        ? (ws.first_run_tabs_viewed as string[])
        : []

      if (!current.includes(tabId)) {
        await prisma.workspace.update({
          where: { id: ctx.workspaceId },
          data: { first_run_tabs_viewed: [...current, tabId] },
        })
      }
    } catch (err) {
      console.error('[recordTabViewed]', err)
      return { ok: false, error: 'Kunde inte spara förloppet.' }
    }

    await writeOnboardingEvent(ctx.workspaceId, ctx.userId, 'tab_viewed', {
      tab_id: tabId,
    })
    return { ok: true }
  })
}

/**
 * Generic fire-and-forget event writer. Used by the modal for `modal_opened`
 * and the three `path_chosen` card events. There is no primary write — the
 * event row IS the write, and it is best-effort: this action always returns
 * `{ ok: true }` even if the row write fails (logged via
 * `[ONBOARDING_EVENT_WRITE_FAIL]`). Auth failure still propagates from
 * `withWorkspace`.
 */
export async function recordOnboardingEvent(
  eventType: string,
  payload?: Record<string, unknown>
): Promise<ActionResult> {
  return withWorkspace(async (ctx) => {
    await writeOnboardingEvent(ctx.workspaceId, ctx.userId, eventType, payload)
    return { ok: true }
  })
}

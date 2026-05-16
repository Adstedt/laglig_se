/**
 * Story 25.1 (Epic 25) — QA ROBUST-001 helper.
 *
 * Wraps a server-action call (minimiseFirstRunModal / skipLawListGeneration)
 * with try/catch + ActionResult unwrap. Returns `true` on success, `false`
 * on any failure (auth-throw OR `{ok:false}` payload). On failure: logs to
 * console and shows a Sonner error toast — caller must early-return so the
 * modal does NOT close and the user can retry.
 *
 * Telemetry-only writes (`recordOnboardingEvent`) still use fire-and-forget
 * since they don't gate UX state.
 */

import { toast } from 'sonner'

type ActionResult = { ok: true } | { ok: false; error: string }

const DEFAULT_ERROR_MESSAGE = 'Något gick fel. Försök igen.'

export async function runDismissAction(
  action: () => Promise<ActionResult>,
  label: string
): Promise<boolean> {
  let result: ActionResult
  try {
    result = await action()
  } catch (err) {
    console.error(`[FirstRunModal] ${label} threw`, err)
    toast.error(DEFAULT_ERROR_MESSAGE)
    return false
  }
  if (!result.ok) {
    console.error(`[FirstRunModal] ${label} returned ok:false`, result.error)
    toast.error(DEFAULT_ERROR_MESSAGE)
    return false
  }
  return true
}

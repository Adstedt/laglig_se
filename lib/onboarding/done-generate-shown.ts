/**
 * Story 25.6 v1.1 polish (2026-05-19): per-workspace "seen" flag for the
 * done-generate celebration surface.
 *
 * Drives the corner FAB's celebrate-variant rendering: while
 * `law_list_generation_status='completed'` AND this flag is unset, the FAB
 * shows the Sparkles + sage-tint + pulse variant and clicks open the modal
 * at `step='done-generate'`. Once the user actually views the done-generate
 * surface (via FAB click OR the existing SWR auto-transition from tutorial
 * → done-generate), the flag is set and subsequent renders fall back to the
 * plain done variant.
 *
 * Storage choice: localStorage (per-device). Per-user (cross-device)
 * persistence would need a DB column — explicitly deferred per Story 25.6
 * Owner-ack'd decision 7.
 *
 * Pattern mirrors `lib/consent/storage.ts` — pure functions, SSR-safe via
 * `typeof window` guard, try/catch around all storage access for private-
 * browsing + quota errors.
 */

const KEY_PREFIX = 'laglig:done-generate-shown:'

export function hasSeenDoneGenerate(workspaceId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY_PREFIX + workspaceId) === '1'
  } catch {
    return false
  }
}

export function markDoneGenerateShown(workspaceId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + workspaceId, '1')
  } catch {
    // Storage unavailable (private browsing, quota) — graceful degrade.
  }
}

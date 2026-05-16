/**
 * Story 25.0 (Epic 25): FIRST_RUN_MODAL_V0 emergency-disable flag predicate.
 *
 * Extracted as a pure, behaviour-preserving helper so the unset / 'false' /
 * '0' / other-value / casing matrix can be unit-tested (QA TEST-001). The flag
 * is the production one-line emergency-disable lever (AC 30 + AC 36) — it must
 * not silently regress.
 *
 * `dashboard/page.tsx` reads `process.env.FIRST_RUN_MODAL_V0` once at module
 * load and passes the raw value through this helper.
 *
 * Default-on semantics: unset → on; `'false'` / `'0'` (any casing) → off;
 * anything else (including `'true'`, `'1'`, empty string, typos) → on.
 */
export function isFirstRunModalEnabled(envValue: string | undefined): boolean {
  return !['false', '0'].includes((envValue ?? '').toLowerCase())
}

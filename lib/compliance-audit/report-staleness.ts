/**
 * Story 21.12 — Staleness decision for `ComplianceAuditReport`.
 *
 * Pure function extracted to a library module because server-action files
 * (`'use server'`) require every exported symbol to be an async function.
 * Keeping this deterministic helper separate also makes it trivially testable
 * without the full server-action mocking stack.
 *
 * Decision rules:
 *   - No row OR null `pdf_storage_path` → regenerate (includes the post-
 *     Story-21.9 state where `sealCycle` inserts a row with manifest but
 *     leaves the PDF pointer null until the `after()` continuation runs).
 *   - SEALED kind with a populated PDF path → never stale (canonical manifest
 *     is frozen by the seal transaction; content edits are blocked).
 *   - COMPLETE kind → stale iff `mostRecentTouchMs > report.generated_at`.
 */

export interface ReportStalenessInput {
  pdf_storage_path: string | null
  report_kind: 'COMPLETE' | 'SEALED'
  generated_at: Date
}

export function reportNeedsRegeneration(
  report: ReportStalenessInput | null,
  mostRecentTouchMs: number | null
): boolean {
  if (report === null) return true
  if (report.pdf_storage_path === null) return true
  if (report.report_kind === 'SEALED') return false
  if (mostRecentTouchMs === null) return false
  return mostRecentTouchMs > report.generated_at.getTime()
}

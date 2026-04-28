/**
 * Story 21.12 — Staleness decision for `ComplianceAuditReport`.
 *
 * Pure function extracted to a library module because server-action files
 * (`'use server'`) require every exported symbol to be an async function.
 * Keeping this deterministic helper separate also makes it trivially testable
 * without the full server-action mocking stack.
 *
 * Story 21.26 — SEAL collapsed; only COMPLETE kind remains. Decision rules:
 *   - No row OR null `pdf_storage_path` → regenerate.
 *   - Otherwise stale iff `mostRecentTouchMs > report.generated_at`.
 */

export interface ReportStalenessInput {
  pdf_storage_path: string | null
  report_kind: 'COMPLETE'
  generated_at: Date
}

export function reportNeedsRegeneration(
  report: ReportStalenessInput | null,
  mostRecentTouchMs: number | null
): boolean {
  if (report === null) return true
  if (report.pdf_storage_path === null) return true
  if (mostRecentTouchMs === null) return false
  return mostRecentTouchMs > report.generated_at.getTime()
}

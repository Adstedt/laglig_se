/**
 * Story 21.7 — centralised SWR keys for compliance-audit caches.
 * Architecture §8.1 calls for a dedicated swr-keys module; this is the first
 * file in it. Story 21.5 kept the items key inline — moved here as a small
 * quality-of-life refactor so both keys live in one place.
 */

export function complianceFindingsKey(cycleId: string): string {
  return `compliance-findings:${cycleId}`
}

export function complianceAuditItemsKey(cycleId: string): string {
  return `compliance-audit-items:${cycleId}`
}

/**
 * Story 21.9 v0.5 — DRAFT-status styrdokument linked as evidence to any
 * item in the cycle's scope. Surfaced in `SealCycleDialog` to support the
 * snapshot-and-accept-with-override pattern.
 */
export function complianceDraftEvidenceDocsKey(cycleId: string): string {
  return `compliance-draft-evidence-docs:${cycleId}`
}

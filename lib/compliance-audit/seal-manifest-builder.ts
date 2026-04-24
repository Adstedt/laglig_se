/**
 * Story 21.9 — builds the deterministic `SealManifestInput` that gets
 * canonicalised + SHA-256-hashed at seal time.
 *
 * **Privacy + size rationale:** free-text fields (`motivering`, finding
 * `description`, finding `rootCause`) are SHA-hashed in the manifest rather
 * than embedded. The manifest never contains raw PII-adjacent text — only
 * the cycle-row text does. The manifest's hash verifies those rows haven't
 * been edited post-seal.
 *
 * **Null-preservation contract:** every optional field is included in the
 * manifest with `null` when absent, NOT omitted. `JSON.stringify` +
 * `canonicalize` normalise key ordering; omitted vs null-valued fields
 * produce different hashes, so the contract is "always include every field,
 * use null for absent values". Dropping a field silently into the hash
 * input is a BREAKING CHANGE — any schema addition must be accompanied by a
 * deliberate fixture update in the same PR.
 *
 * **Determinism:** items/findings/evidence arrays are sorted by stable keys
 * (primary key for items + findings; composite (kind, evidenceId) for
 * evidence) so two calls with the same input data produce byte-identical
 * output. `sealedAt` is caller-provided (not computed here) — the caller is
 * responsible for fixing the timestamp once up-front and threading it
 * through both the manifest and the Prisma cycle-update.
 *
 * [Source: Story 21.9 AC 5; architecture/epic-21-lagefterlevnadskontroll.md §4.1, §5.1]
 */

import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'

export type AuditType = 'INTERN' | 'EXTERN'
export type EfterlevnadsBedomning =
  | 'UPPFYLLD'
  | 'DELVIS'
  | 'EJ_UPPFYLLD'
  | 'EJ_TILLAMPLIG'
export type FindingType = 'AVVIKELSE' | 'OBSERVATION' | 'FORBATTRING'
export type FindingSeverity = 'MAJOR' | 'MINOR'
export type EvidenceKind = 'FILE' | 'DOCUMENT'

export interface SealManifestItem {
  id: string
  lawListItemId: string
  efterlevnadsbedomning: EfterlevnadsBedomning | null
  motiveringSha256: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  signedOffAt: string | null
  signedOffByUserId: string | null
}

export interface SealManifestFinding {
  id: string
  type: FindingType
  severity: FindingSeverity | null
  title: string
  descriptionSha256: string
  rootCauseSha256: string | null
  lawListItemId: string | null
  requirementId: string | null
  correctiveActionTaskId: string | null
  dueDate: string | null
  closedAt: string | null
  closedByUserId: string | null
}

export interface SealManifestEvidence {
  lawListItemId: string | null
  requirementId: string | null
  kind: EvidenceKind
  evidenceId: string
  sha256: string
}

/**
 * Story 21.9 v0.5 — when a seal proceeds despite linked styrdokument being
 * in DRAFT status (snapshot-and-accept-with-override pattern), the IDs +
 * titles of those drafts are locked into the canonical manifest. Future
 * re-verification can confirm "yes, these specific drafts were knowingly
 * included via override." Empty array when no drafts were acknowledged.
 */
export interface SealManifestDraftDocument {
  id: string
  title: string
}

export interface SealManifestInput {
  cycleId: string
  workspaceId: string
  lawListId: string
  name: string
  auditType: AuditType
  scheduledStart: string
  scheduledEnd: string
  lawChangeCutoffDate: string
  leadAuditorUserId: string
  createdByUserId: string
  createdAt: string
  sealedAt: string
  sealedByUserId: string
  scopeDefinition: ScopeDefinition
  overrideReason: string | null
  /**
   * v0.5 — DRAFT-status styrdokument that were knowingly included as
   * evidence via the snapshot-and-accept override. Always present in the
   * canonical input (even as `[]`) so the hash shape stays stable across
   * cycles with and without the override invoked.
   */
  draftDocumentsAtSeal: SealManifestDraftDocument[]
  items: SealManifestItem[]
  findings: SealManifestFinding[]
  evidence: SealManifestEvidence[]
}

/**
 * Pass-through builder that returns a new object with its array fields
 * deterministically sorted. Does not mutate `input`.
 */
export function buildSealManifest(input: SealManifestInput): SealManifestInput {
  return {
    ...input,
    items: [...input.items].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    ),
    findings: [...input.findings].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    ),
    evidence: [...input.evidence].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
      if (a.evidenceId !== b.evidenceId)
        return a.evidenceId < b.evidenceId ? -1 : 1
      // Tie-break by lawListItemId (nullable — nulls sort last for stability)
      const aLl = a.lawListItemId ?? '￿'
      const bLl = b.lawListItemId ?? '￿'
      if (aLl !== bLl) return aLl < bLl ? -1 : 1
      const aReq = a.requirementId ?? '￿'
      const bReq = b.requirementId ?? '￿'
      return aReq < bReq ? -1 : aReq > bReq ? 1 : 0
    }),
    draftDocumentsAtSeal: [...input.draftDocumentsAtSeal].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    ),
  }
}

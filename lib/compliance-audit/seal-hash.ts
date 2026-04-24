/**
 * Story 21.9 — SHA-256 over the canonicalised seal manifest.
 *
 * Returns BOTH the canonical JSON string (to persist in
 * `ComplianceAuditReport.manifest` for offline re-verification) AND the hex
 * hash (to persist on `ComplianceAuditCycle.seal_hash`). Returning both
 * avoids a second canonicalisation round over the identical data.
 *
 * Deterministic — no random salt, no time-dependent input. The `sealedAt`
 * ISO string IS part of the manifest input, which means two real
 * `sealCycle` invocations at different wall-clock times produce different
 * hashes (as intended — they are different seal events). The IV2
 * determinism contract is a PURE-FUNCTION property of this `computeSealHash`
 * function: same manifest in → same hash out.
 *
 * [Source: Story 21.9 AC 7, IV2 (NH-2 sharpened); architecture §5.1]
 */

import { createHash } from 'node:crypto'
import { canonicalizeSealInput } from '@/lib/compliance-audit/canonicalize'
import type { SealManifestInput } from '@/lib/compliance-audit/seal-manifest-builder'

export interface SealHashResult {
  canonicalJson: string
  hash: string
}

export function computeSealHash(manifest: SealManifestInput): SealHashResult {
  const canonicalJson = canonicalizeSealInput(manifest)
  const hash = createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
  return { canonicalJson, hash }
}

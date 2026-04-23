/**
 * Story 21.7 — Swedish label constants for findings UI.
 * Mirrors `bedomning-copy.ts` pattern. The definite-form labels used in the
 * activity-log sentence (avvikelsen / observationen / förbättringsförslaget)
 * live in `lib/activity/format-activity.ts` as `FINDING_TYPE_LABELS_DEFINITE`.
 */

import type { FindingSeverity, FindingType } from '@prisma/client'

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  AVVIKELSE: 'Avvikelse',
  OBSERVATION: 'Observation',
  FORBATTRING: 'Förbättringsförslag',
}

/**
 * NH-1 (PO v0.2): `'Större'` / `'Mindre'` is the standard terminology used by
 * Swedish-speaking certification bodies (SIS, RISE, Kiwa) when translating
 * ISO 19011 audit findings. Locked at Story 21.7 — future rename is a
 * single-file edit if product pushes back.
 */
export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  MAJOR: 'Större',
  MINOR: 'Mindre',
}

export const FINDING_TYPE_OPTIONS: ReadonlyArray<{
  value: FindingType
  label: string
}> = [
  { value: 'AVVIKELSE', label: FINDING_TYPE_LABELS.AVVIKELSE },
  { value: 'OBSERVATION', label: FINDING_TYPE_LABELS.OBSERVATION },
  { value: 'FORBATTRING', label: FINDING_TYPE_LABELS.FORBATTRING },
]

export const FINDING_SEVERITY_OPTIONS: ReadonlyArray<{
  value: FindingSeverity
  label: string
}> = [
  { value: 'MAJOR', label: FINDING_SEVERITY_LABELS.MAJOR },
  { value: 'MINOR', label: FINDING_SEVERITY_LABELS.MINOR },
]

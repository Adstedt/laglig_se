/**
 * Story 21.7 — Swedish label constants for findings UI.
 * Mirrors `bedomning-copy.ts` pattern. The definite-form labels used in the
 * activity-log sentence (avvikelsen / observationen / förbättringsförslaget)
 * live in `lib/activity/format-activity.ts` as `FINDING_TYPE_LABELS_DEFINITE`.
 */

import type { FindingSeverity, FindingType } from '@prisma/client'
import type { FindingRow } from '@/app/actions/compliance-finding'

/**
 * Epic 21 follow-up: three-state finding status derived from existing
 * FindingRow fields. No schema change — `closedAt` + `correctiveActionTask`
 * already carry everything we need.
 *
 *  - `closed` → finding has been closed (with or without a linked task).
 *  - `ready-to-verify` → finding is open AND has a corrective-action task
 *    whose `completedAt` is set. The auditor's verification moment.
 *  - `open` → anything else (no task, or task still in progress).
 *
 * Used to drive the status badge + action-button switch on the Findings tab.
 * The auditor's "Verifiera" step is explicit only when status is
 * `ready-to-verify` — otherwise the button is plain "Stäng".
 */
export type FindingStatus = 'open' | 'ready-to-verify' | 'closed'

export function getFindingStatus(finding: FindingRow): FindingStatus {
  if (finding.closedAt !== null) return 'closed'
  if (
    finding.correctiveActionTask !== null &&
    finding.correctiveActionTask.completedAt !== null
  ) {
    return 'ready-to-verify'
  }
  return 'open'
}

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

/**
 * Epic 21 follow-up: type-specific copy for the finding-editor form.
 *
 * The three finding types capture fundamentally different intents, and
 * shared AVVIKELSE-centric copy ("Varför uppstod avvikelsen?") feels wrong
 * on OBSERVATION / FÖRBÄTTRING forms. This helper returns the right
 * placeholder + helper text + root-cause label for the currently-selected
 * type. Notable semantic shift: FÖRBÄTTRING renames "Grundorsak" to
 * "Motivering" — improvement suggestions don't have root causes, they
 * have rationales.
 */
export interface FindingTypeCopy {
  titlePlaceholder: string
  descriptionHelper: string
  rootCauseLabel: string
  rootCauseHelper: string
}

export function getFindingTypeCopy(type: FindingType): FindingTypeCopy {
  switch (type) {
    case 'AVVIKELSE':
      return {
        titlePlaceholder: 'T.ex. Saknad utbildningsplan för kemikaliehantering',
        descriptionHelper:
          'Beskriv avvikelsen — vilken brist mot kravet upptäcktes? (Vad hände?)',
        rootCauseLabel: 'Grundorsak (frivilligt)',
        rootCauseHelper:
          'Varför uppstod avvikelsen? Fylls ofta i senare under åtgärdsplaneringen.',
      }
    case 'OBSERVATION':
      return {
        titlePlaceholder: 'T.ex. Brandövningar har inte dokumenterats',
        descriptionHelper:
          'Beskriv observationen — vad noterades? Inte en tydlig avvikelse, men värt att uppmärksamma.',
        rootCauseLabel: 'Grundorsak (frivilligt)',
        rootCauseHelper:
          'Varför uppstår situationen? Vilka faktorer bidrar? (Frivilligt — kan analyseras senare.)',
      }
    case 'FORBATTRING':
      return {
        titlePlaceholder:
          'T.ex. Automatisera påminnelser för återkommande besiktningar',
        descriptionHelper:
          'Beskriv förslaget — vilken förbättring ser du potential för?',
        rootCauseLabel: 'Motivering (frivilligt)',
        rootCauseHelper:
          'Vilket värde skulle förslaget ge? Koppling till mål, risker eller effektivitet.',
      }
  }
}

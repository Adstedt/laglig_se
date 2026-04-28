/**
 * Story 21.7 — Swedish label constants for findings UI.
 * Mirrors `bedomning-copy.ts` pattern. The definite-form labels used in the
 * activity-log sentence (avvikelsen / observationen / förbättringsförslaget)
 * live in `lib/activity/format-activity.ts` as `FINDING_TYPE_LABELS_DEFINITE`.
 */

import type { FindingSeverity, FindingType } from '@prisma/client'
import type { FindingRow } from '@/app/actions/compliance-finding'

/**
 * Phase 2 / Epic 23 foundation — five-state finding status derived from
 * existing FindingRow fields plus the new `verificationNote` / `closeReason`
 * columns (denormalised closure metadata, source-of-truth still in activity log).
 *
 *  - `open` — closedAt null, no linked task OR task still in progress
 *  - `ready-to-verify` — closedAt null, linked task `completedAt` is set
 *  - `closed-verified` — closedAt set, `verificationNote` populated (verify path)
 *  - `closed-plain` — closedAt set, both metadata fields null (direct close)
 *  - `closed-dismissed` — closedAt set, `closeReason` populated (manual override)
 *
 * Used to drive the status badge in `FindingCard` and the action-button switch
 * in the cycle findings tab. Phase 3 / Epic 23 will collapse the action UX into
 * a single "Markera som åtgärdat" verb invoked from a workspace-level FindingModal,
 * but the five-state derivation is foundational for the registry's badge column.
 */
export type FindingStatus =
  | 'open'
  | 'ready-to-verify'
  | 'closed-verified'
  | 'closed-plain'
  | 'closed-dismissed'

export function getFindingStatus(finding: FindingRow): FindingStatus {
  if (finding.closedAt !== null) {
    if (finding.closeReason != null) return 'closed-dismissed'
    if (finding.verificationNote != null) return 'closed-verified'
    return 'closed-plain'
  }
  if (finding.correctiveActionTask?.completedAt != null) {
    return 'ready-to-verify'
  }
  return 'open'
}

/**
 * Centralised badge config consumed by `FindingCard`. Open findings render
 * NO badge by default (current behavior — open is the assumed state); only
 * the four post-default states surface a visible badge.
 */
export interface FindingStatusBadge {
  /** Swedish label rendered in the badge */
  label: string
  /** Tailwind class string for background + text + border */
  className: string
  /** Optional icon prefix (rendered inline-flex before the label) */
  icon?: 'check' | 'circle-dashed'
  /** Optional strike-through styling on the label (used for Avskriven) */
  strike?: boolean
}

export const FINDING_STATUS_BADGES: Record<
  FindingStatus,
  FindingStatusBadge | null
> = {
  // Open findings render no explicit badge — the absence IS the signal.
  // Matches Story 21.16 decision: "open findings don't carry an explicit
  // 'Öppen' badge" (closed/special states are the exception).
  open: null,
  'ready-to-verify': {
    label: 'Redo att verifiera',
    className:
      'border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  'closed-verified': {
    label: 'Åtgärdad',
    className:
      'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    icon: 'check',
  },
  'closed-plain': {
    label: 'Åtgärdad',
    className:
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  'closed-dismissed': {
    label: 'Avskriven',
    className:
      'border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
    strike: true,
  },
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

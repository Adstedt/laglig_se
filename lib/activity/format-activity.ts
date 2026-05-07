import type { ResolvedEntityRef, SentencePart } from './types'

type FormatInput = {
  action: string
  entity_type: string
  user: { name: string | null; email: string }
  old_value: unknown
  new_value: unknown
  primary: ResolvedEntityRef
  secondary?: ResolvedEntityRef
}

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  EJ_PABORJAD: 'ej påbörjad',
  PAGAENDE: 'pågående',
  UPPFYLLD: 'uppfylld',
  EJ_UPPFYLLD: 'ej uppfylld',
  EJ_TILLAMPLIG: 'ej tillämplig',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'låg',
  MEDIUM: 'medel',
  HIGH: 'hög',
  CRITICAL: 'kritisk',
}

const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'utkast',
  IN_REVIEW: 'under granskning',
  APPROVED: 'godkänd',
  SUPERSEDED: 'ersatt',
  ARCHIVED: 'arkiverad',
}

/**
 * Story 21.13: Swedish labels for cycle-item efterlevnadsbedomning values.
 * MUST match the canonical labels in `components/features/compliance-audit/bedomning-copy.ts`
 * — users see the same string on the cycle detail page and in the activity feed.
 */
const EFTERLEVNADS_BEDOMNING_LABELS: Record<string, string> = {
  UPPFYLLD: 'Uppfylld',
  DELVIS: 'Delvis',
  EJ_UPPFYLLD: 'Ej uppfylld',
  EJ_TILLAMPLIG: 'Ej tillämplig',
}

/**
 * Story 21.7: Definite-form Swedish labels for FindingType values used in the
 * `finding_created` sentence ("… skapade avvikelsen Saknad utbildningsplan").
 * The form used in the editor dialog is the indefinite form (Avvikelse /
 * Observation / Förbättringsförslag) — see `components/features/compliance-audit/finding-copy.ts`.
 */
const FINDING_TYPE_LABELS_DEFINITE: Record<string, string> = {
  AVVIKELSE: 'avvikelsen',
  OBSERVATION: 'observationen',
  FORBATTRING: 'förbättringsförslaget',
}

const CLOSE_REASON_MAX_CHARS = 80

const BEDOMNING_NULL_LABEL = '—'

function payloadOf(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function pickString(
  p: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!p) return null
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function refPart(ref: ResolvedEntityRef): SentencePart {
  if (ref.href) {
    return { kind: 'link', href: ref.href, label: ref.label, deleted: false }
  }
  return {
    kind: 'link',
    href: '#',
    label: ref.label,
    deleted: ref.deleted,
  }
}

function text(value: string): SentencePart {
  return { kind: 'text', value }
}

function emphasis(value: string): SentencePart {
  return { kind: 'emphasis', value }
}

function userPart(input: FormatInput): SentencePart {
  return {
    kind: 'user',
    name: input.user.name ?? input.user.email,
  }
}

function mapEnum(
  value: unknown,
  table: Record<string, string>,
  fallback = '–'
): string {
  if (typeof value !== 'string') return fallback
  return table[value] ?? value.toLowerCase()
}

function mapAssignee(value: unknown): string {
  if (value === null || value === undefined) return 'ingen'
  if (typeof value === 'string' && value.length > 0) return value
  return 'ingen'
}

function formatDateValue(value: unknown): string {
  if (typeof value !== 'string') return '–'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Produce the inline Swedish sentence for one activity row, returned as a
 * list of parts the UI renders (user/text/emphasis/link). The CSV export
 * flattens the same list with `.map(p => p.value ?? p.label).join('')`.
 *
 * Unknown actions fall through the `default` arm so the feed is never blank.
 */
export function formatActivity(input: FormatInput): SentencePart[] {
  const u = userPart(input)
  const oldP = payloadOf(input.old_value)
  const newP = payloadOf(input.new_value)
  const primary = refPart(input.primary)
  const secondary = input.secondary ? refPart(input.secondary) : null

  switch (input.action) {
    // ----------------- Task lifecycle -----------------
    case 'created':
      return [u, text(' skapade uppgiften '), primary]

    case 'deleted':
      return [
        u,
        text(' raderade uppgiften '),
        emphasis(pickString(oldP, 'title') ?? input.primary.label),
      ]

    case 'title_updated':
      return [
        u,
        text(' ändrade titel på '),
        primary,
        text(' från '),
        emphasis(pickString(oldP, 'title') ?? '–'),
        text(' till '),
        emphasis(pickString(newP, 'title') ?? '–'),
      ]

    case 'description_updated':
      return [u, text(' uppdaterade beskrivningen på '), primary]

    case 'status_updated':
      return [
        u,
        text(' flyttade uppgiften '),
        primary,
        text(' från '),
        emphasis(pickString(oldP, 'status') ?? '–'),
        text(' till '),
        emphasis(pickString(newP, 'status') ?? '–'),
      ]

    case 'assignee_updated':
      return [
        u,
        text(' ändrade ansvarig på '),
        primary,
        text(' från '),
        emphasis(mapAssignee(oldP?.assignee)),
        text(' till '),
        emphasis(mapAssignee(newP?.assignee)),
      ]

    case 'due_date_updated':
      return [
        u,
        text(' ändrade förfallodatum på '),
        primary,
        text(' från '),
        emphasis(formatDateValue(oldP?.due_date)),
        text(' till '),
        emphasis(formatDateValue(newP?.due_date)),
      ]

    case 'priority_updated':
      return [
        u,
        text(' ändrade prioritet på '),
        primary,
        text(' från '),
        emphasis(mapEnum(oldP?.priority, PRIORITY_LABELS)),
        text(' till '),
        emphasis(mapEnum(newP?.priority, PRIORITY_LABELS)),
      ]

    case 'labels_updated':
      return [u, text(' uppdaterade etiketter på '), primary]

    case 'law_linked': {
      const lawTitle = pickString(newP, 'law_title')
      return lawTitle
        ? [
            u,
            text(' kopplade '),
            emphasis(lawTitle),
            text(' till uppgiften '),
            primary,
          ]
        : [u, text(' kopplade en lag till uppgiften '), primary]
    }

    case 'law_unlinked': {
      const lawTitle = pickString(oldP, 'law_title')
      return lawTitle
        ? [
            u,
            text(' kopplade bort '),
            emphasis(lawTitle),
            text(' från uppgiften '),
            primary,
          ]
        : [u, text(' tog bort en lag-länk från uppgiften '), primary]
    }

    // ----------------- List item compliance -----------------
    case 'status_changed':
      return [
        u,
        text(' ändrade efterlevnadsstatus på '),
        primary,
        text(' från '),
        emphasis(mapEnum(oldP?.compliance_status, COMPLIANCE_STATUS_LABELS)),
        text(' till '),
        emphasis(mapEnum(newP?.compliance_status, COMPLIANCE_STATUS_LABELS)),
      ]

    case 'priority_changed':
      return [
        u,
        text(' ändrade prioritet på '),
        primary,
        text(' från '),
        emphasis(mapEnum(oldP?.priority, PRIORITY_LABELS)),
        text(' till '),
        emphasis(mapEnum(newP?.priority, PRIORITY_LABELS)),
      ]

    case 'responsible_changed':
      return [u, text(' ändrade ansvarig person på '), primary]

    case 'business_context_updated':
      return [u, text(' uppdaterade affärskontexten på '), primary]

    case 'compliance_narrative_updated':
      return [u, text(' uppdaterade efterlevnadsbeskrivningen på '), primary]

    // ----------------- Comments -----------------
    case 'comment_added':
      return [u, text(' skrev en kommentar på '), primary]

    case 'comment_updated':
      return [u, text(' redigerade en kommentar på '), primary]

    case 'comment_deleted':
      return [u, text(' raderade en kommentar på '), primary]

    // ----------------- Evidence (legacy) -----------------
    case 'evidence_uploaded':
      return [u, text(' laddade upp bevis på '), primary]

    case 'evidence_deleted':
      return [u, text(' raderade bevis på '), primary]

    // ----------------- Task ↔ list item (legacy) -----------------
    case 'task_linked':
      return [u, text(' länkade en uppgift till '), primary]

    case 'task_unlinked':
      return [u, text(' tog bort en uppgiftslänk från '), primary]

    // ----------------- Requirements / kravpunkter -----------------
    case 'requirement_created': {
      const reqText = pickString(newP, 'text') ?? input.primary.label
      const parts: SentencePart[] = [
        u,
        text(' skapade kravpunkten '),
        emphasis(reqText),
      ]
      if (secondary) parts.push(text(' på '), secondary)
      return parts
    }

    case 'requirement_deleted': {
      const reqText =
        pickString(oldP, 'text') ?? input.primary.label ?? 'en kravpunkt'
      const parts: SentencePart[] = [
        u,
        text(' tog bort kravpunkten '),
        emphasis(reqText),
      ]
      if (secondary) parts.push(text(' från '), secondary)
      return parts
    }

    case 'requirement_text_updated':
      return [u, text(' ändrade texten på kravpunkten '), primary]

    case 'requirement_marked_fulfilled':
      return [
        u,
        text(' markerade kravpunkten '),
        primary,
        text(' som uppfylld'),
      ]

    case 'requirement_marked_unfulfilled':
      return [
        u,
        text(' markerade kravpunkten '),
        primary,
        text(' som ej uppfylld'),
      ]

    case 'requirement_marked_bevis_required':
      return [u, text(' krävde bevis på kravpunkten '), primary]

    case 'requirement_marked_bevis_optional':
      return [u, text(' gjorde bevis valfritt på kravpunkten '), primary]

    case 'requirement_evidence_linked': {
      const parts: SentencePart[] = [
        u,
        text(' kopplade bevis till kravpunkten '),
        primary,
      ]
      if (secondary) parts.push(text(' ('), secondary, text(')'))
      return parts
    }

    case 'requirement_evidence_unlinked':
      return [u, text(' tog bort bevis från kravpunkten '), primary]

    case 'requirement_comment_updated': {
      const oldComment = pickString(oldP, 'comment')
      const newComment = pickString(newP, 'comment')
      if (!oldComment && newComment) {
        return [u, text(' skrev en kommentar på kravpunkten '), primary]
      }
      if (oldComment && !newComment) {
        return [u, text(' tog bort kommentaren från kravpunkten '), primary]
      }
      return [u, text(' redigerade kommentaren på kravpunkten '), primary]
    }

    // ----------------- Workspace documents -----------------
    case 'document_created':
      return [u, text(' skapade styrdokumentet '), primary]

    case 'document_imported':
      return [u, text(' importerade styrdokumentet '), primary]

    case 'document_version_saved': {
      const version = newP?.version_number
      return [
        u,
        text(' sparade version '),
        emphasis(typeof version === 'number' ? String(version) : '–'),
        text(' av '),
        primary,
      ]
    }

    case 'document_version_restored': {
      const version = newP?.restored_from_version
      return [
        u,
        text(' återställde '),
        primary,
        text(' till version '),
        emphasis(typeof version === 'number' ? String(version) : '–'),
      ]
    }

    case 'document_status_changed':
      return [
        u,
        text(' ändrade dokumentstatus på '),
        primary,
        text(' från '),
        emphasis(mapEnum(oldP?.status, DOC_STATUS_LABELS)),
        text(' till '),
        emphasis(mapEnum(newP?.status, DOC_STATUS_LABELS)),
      ]

    case 'document_linked_to_task': {
      const parts: SentencePart[] = [u, text(' kopplade dokumentet '), primary]
      if (secondary) parts.push(text(' till uppgiften '), secondary)
      else parts.push(text(' till en uppgift'))
      return parts
    }

    case 'document_linked_to_list_item': {
      const parts: SentencePart[] = [u, text(' kopplade dokumentet '), primary]
      if (secondary) parts.push(text(' till '), secondary)
      else parts.push(text(' till en laglistpost'))
      return parts
    }

    case 'document_unlinked_from_task': {
      const parts: SentencePart[] = [
        u,
        text(' tog bort dokumentkopplingen mellan '),
        primary,
      ]
      if (secondary) parts.push(text(' och uppgiften '), secondary)
      else parts.push(text(' och en uppgift'))
      return parts
    }

    case 'document_unlinked_from_list_item': {
      const parts: SentencePart[] = [
        u,
        text(' tog bort dokumentkopplingen mellan '),
        primary,
      ]
      if (secondary) parts.push(text(' och '), secondary)
      else parts.push(text(' och en laglistpost'))
      return parts
    }

    // ----------------- Notifications -----------------
    case 'notification_sent': {
      const template = pickString(newP, 'template') ?? 'okänd mall'
      const recipient = pickString(newP, 'recipient')
      const parts: SentencePart[] = [
        u,
        text(' skickade notisen '),
        emphasis(template),
      ]
      if (recipient) parts.push(text(' till '), emphasis(recipient))
      return parts
    }

    // ----------------- Compliance-audit cycle / items (Epic 21) -----------------
    case 'cycle_created':
      return [u, text(' skapade kontrollen '), primary]

    case 'cycle_metadata_updated': {
      const oldName = pickString(oldP, 'name')
      const newName = pickString(newP, 'name')
      const parts: SentencePart[] = [
        u,
        text(' uppdaterade metadata på kontrollen '),
        primary,
      ]
      // Name-change tail mirrors the `title_updated` formatter precedent
      // (lines 128-137): surface the rename inline for users who don't
      // expand the row. The expanded-row diff view still shows all fields.
      if (oldName && newName && oldName !== newName) {
        parts.push(
          text(': namnet ändrades från '),
          emphasis(oldName),
          text(' till '),
          emphasis(newName)
        )
      }
      return parts
    }

    case 'cycle_soft_deleted':
      return [u, text(' tog bort kontrollen '), primary]

    case 'cycle_materialised': {
      const itemCount = newP?.itemCount
      if (typeof itemCount === 'number') {
        return [
          u,
          text(' startade kontrollen '),
          primary,
          text(` (${itemCount} dokument)`),
        ]
      }
      return [u, text(' startade kontrollen '), primary]
    }

    case 'cycle_item_bedomning_updated':
      return [
        u,
        text(' ändrade bedömning på '),
        primary,
        text(' från '),
        emphasis(
          mapEnum(
            oldP?.efterlevnadsbedomning,
            EFTERLEVNADS_BEDOMNING_LABELS,
            BEDOMNING_NULL_LABEL
          )
        ),
        text(' till '),
        emphasis(
          mapEnum(
            newP?.efterlevnadsbedomning,
            EFTERLEVNADS_BEDOMNING_LABELS,
            BEDOMNING_NULL_LABEL
          )
        ),
      ]

    // Privacy contract: Story 21.5's logActivity payload for motivering edits
    // stores `{old_length, new_length}` only — the raw motivering text is
    // NEVER in the log. This sentence is intentionally generic; the
    // expanded-row view shows the length diff.
    case 'cycle_item_motivering_updated':
      return [u, text(' uppdaterade motiveringen på '), primary]

    case 'cycle_item_signed_off':
      return [u, text(' signerade '), primary]

    case 'cycle_item_unsigned':
      return [u, text(' ångrade signeringen på '), primary]

    // Story 21.6 — cycle lifecycle transitions
    case 'cycle_completed':
      return [u, text(' slutförde kontrollen '), primary]

    case 'cycle_reverted_to_pagaende':
      return [
        u,
        text(' återställde kontrollen '),
        primary,
        text(' till pågående'),
      ]

    // Story 21.9 — seal
    case 'cycle_sealed':
      return [u, text(' fastställde kontrollen '), primary]

    // Story 21.12 — revisionsrapport PDF generation
    // Story 21.26 — kind-branching dropped; only COMPLETE remains.
    case 'cycle_report_generated':
      return [u, text(' genererade revisionsrapport')]

    // ----------------- Compliance-audit findings (Epic 21) -----------------
    case 'finding_created': {
      const typeLabel =
        typeof newP?.type === 'string'
          ? (FINDING_TYPE_LABELS_DEFINITE[newP.type] ?? 'en anmärkning')
          : 'en anmärkning'
      return [u, text(' skapade '), text(typeLabel), text(' '), primary]
    }

    case 'finding_updated':
      return [u, text(' uppdaterade '), primary]

    case 'finding_closed': {
      const manualOverride = newP?.manual_override === true
      const reason = pickString(newP, 'close_reason')
      const parts: SentencePart[] = [u, text(' stängde '), primary]
      if (manualOverride && reason) {
        const truncated =
          reason.length > CLOSE_REASON_MAX_CHARS
            ? reason.slice(0, CLOSE_REASON_MAX_CHARS) + '…'
            : reason
        parts.push(text(': anledning — '), emphasis(truncated))
      }
      return parts
    }

    case 'finding_reopened':
      return [u, text(' återöppnade '), primary]

    // Epic 21 follow-up — verify step. Emitted alongside finding_closed when
    // the auditor uses the explicit "Verifiera" action. Optional verification
    // note is the audit evidence; truncated to 80 chars like close_reason.
    case 'finding_verified': {
      const note = pickString(newP, 'verification_note')
      const parts: SentencePart[] = [u, text(' verifierade '), primary]
      if (note) {
        const truncated =
          note.length > CLOSE_REASON_MAX_CHARS
            ? note.slice(0, CLOSE_REASON_MAX_CHARS) + '…'
            : note
        parts.push(text(': '), emphasis(truncated))
      }
      return parts
    }

    // ----------------- Compliance-audit findings — task loop (Epic 21 — Story 21.8) -----------------
    case 'finding_task_spawned': {
      const taskTitle = pickString(newP, 'task_title') ?? 'en åtgärdsuppgift'
      return [
        u,
        text(' skapade åtgärdsuppgift '),
        emphasis(taskTitle),
        text(' kopplad till '),
        primary,
      ]
    }

    case 'finding_task_completed':
      return [
        u,
        text(' markerade åtgärdsuppgiften för '),
        primary,
        text(' som klar'),
      ]

    case 'finding_task_completion_notified':
      return [
        text('Systemet skickade en notis: åtgärdsuppgiften för '),
        primary,
        text(' är klar'),
      ]

    // ----------------- Trial expiration lifecycle (Story 5.13) -----------------
    case 'trial_expired':
      return [text('Provperioden för '), primary, text(' gick ut')]

    case 'trial_paused':
      return [
        text('Workspace '),
        primary,
        text(' pausades efter 30 dagar utan aktivering'),
      ]

    case 'trial_workspace_deleted':
      return [
        text('Workspace '),
        primary,
        text(' markerades för radering efter 60 dagar utan aktivering'),
      ]

    case 'trial_converted':
      return [
        u,
        text(' aktiverade prenumeration för '),
        primary,
        text(' — provperiod konverterad'),
      ]

    case 'workspace_reactivated_from_trial_pause':
      return [
        u,
        text(' återaktiverade '),
        primary,
        text(' efter trial-pause via Stripe Checkout'),
      ]

    // ----------------- Epic 24: Import existing law list (Story 24.1) -----------------
    case 'law_list_import.created':
      return [u, text(' skapade laglistimporten '), primary]

    case 'law_list_import.committed':
      return [u, text(' bekräftade laglistimporten '), primary]

    // ----------------- Story 24.3: matching lifecycle -----------------
    case 'law_list_import.matching_started':
      return [u, text(' startade matchningen för '), primary]

    case 'law_list_import.matching_completed': {
      const high = newP?.matched_high_count
      const med = newP?.matched_medium_count
      const un = newP?.unmatched_count
      const parts: SentencePart[] = [
        u,
        text(' avslutade matchningen för '),
        primary,
      ]
      if (
        typeof high === 'number' &&
        typeof med === 'number' &&
        typeof un === 'number'
      ) {
        parts.push(text(` (${high} hög, ${med} medel, ${un} omatchade)`))
      }
      return parts
    }

    case 'law_list_import.matching_failed':
      return [
        text('Matchningen misslyckades för '),
        primary,
        text(' — kontakta support'),
      ]

    // ----------------- Story 24.4: review-surface decisions -----------------
    case 'law_list_import.row_accepted':
      return [u, text(' accepterade en matchning i '), primary]

    case 'law_list_import.row_replaced':
      return [u, text(' bytte matchning för en rad i '), primary]

    case 'law_list_import.row_rejected':
      return [u, text(' avvisade en matchning i '), primary]

    case 'law_list_import.row_catalog_requested':
      return [u, text(' begärde katalogtillägg för en rad i '), primary]

    case 'law_list_import.row_decision_undone':
      return [u, text(' ångrade ett beslut för en rad i '), primary]

    case 'law_list_import.bulk_accepted_high': {
      const count = newP?.count
      const parts: SentencePart[] = [
        u,
        text(' accepterade alla höga matchningar i '),
        primary,
      ]
      if (typeof count === 'number') parts.push(text(` (${count} rader)`))
      return parts
    }

    case 'law_list_import.discarded':
      // The import + all rows are gone by the time the activity log renders,
      // so `primary` (entity-resolved label) falls back to the snapshot
      // filename embedded in oldValue. Keep the sentence terse.
      return [u, text(' avbröt importen '), primary]

    // ----------------- Story 24.5: catalog-requests admin queue -----------------
    case 'catalog_request.fulfilled': {
      const docTitle = pickString(
        newP,
        'document_title',
        'fulfilled_with_document_title'
      )
      const parts: SentencePart[] = [
        u,
        text(' hanterade katalogtillägg för '),
        primary,
      ]
      if (docTitle) {
        parts.push(text(' — matchat mot '), emphasis(docTitle))
      }
      return parts
    }

    case 'catalog_request.rejected': {
      const reason = pickString(newP, 'admin_note', 'reason')
      const parts: SentencePart[] = [
        u,
        text(' avvisade katalogtillägg för '),
        primary,
      ]
      if (reason) {
        const truncated =
          reason.length > CLOSE_REASON_MAX_CHARS
            ? reason.slice(0, CLOSE_REASON_MAX_CHARS) + '…'
            : reason
        parts.push(text(': '), emphasis(truncated))
      }
      return parts
    }

    // ----------------- Fallback -----------------
    default:
      return [
        u,
        text(' utförde '),
        emphasis(input.action),
        text(' på '),
        primary,
      ]
  }
}

/** Flatten a SentencePart[] to plain text (for CSV export, aria-labels, etc). */
export function sentencePartsToText(parts: SentencePart[]): string {
  return parts
    .map((p) => {
      if (p.kind === 'user') return p.name
      if (p.kind === 'link') return p.label
      return p.value
    })
    .join('')
}

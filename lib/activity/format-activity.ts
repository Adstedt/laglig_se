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

    case 'compliance_actions_updated':
      return [u, text(' uppdaterade efterlevnadsåtgärderna på '), primary]

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

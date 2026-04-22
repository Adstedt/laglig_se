import { prisma } from '@/lib/prisma'
import type { ResolvedEntityRef } from './types'

type ActivityRowLike = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_value: unknown
  new_value: unknown
}

export type SecondaryRef = { entity_type: string; id: string }

/**
 * Map an activity row to the *secondary* entity it points at (if any) via the
 * payload. Primary is always (entity_type, entity_id); secondary comes from
 * the JSON payload keys agreed by the write sites.
 */
export function getSecondaryRef(row: ActivityRowLike): SecondaryRef | null {
  const payload = (row.new_value ?? row.old_value) as Record<
    string,
    unknown
  > | null
  if (!payload) return null

  const readId = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = payload[k]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return null
  }

  switch (row.action) {
    case 'document_linked_to_task':
    case 'document_unlinked_from_task': {
      const taskId = readId('task_id', 'taskId')
      return taskId ? { entity_type: 'task', id: taskId } : null
    }
    case 'document_linked_to_list_item':
    case 'document_unlinked_from_list_item': {
      const listItemId = readId('list_item_id', 'listItemId')
      return listItemId ? { entity_type: 'list_item', id: listItemId } : null
    }
    case 'requirement_created':
    case 'requirement_deleted': {
      const listItemId = readId('list_item_id', 'listItemId')
      return listItemId ? { entity_type: 'list_item', id: listItemId } : null
    }
    case 'requirement_evidence_linked':
    case 'requirement_evidence_unlinked': {
      const docId = readId('workspace_document_id', 'workspaceDocumentId')
      return docId ? { entity_type: 'workspace_document', id: docId } : null
    }
    default:
      return null
  }
}

type ResolveResult = {
  primary: ResolvedEntityRef
  secondary?: ResolvedEntityRef
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function tombstone(
  entityType: string,
  id: string,
  fallbackLabel?: string | null
): ResolvedEntityRef {
  const label = fallbackLabel
    ? `${fallbackLabel} [borttagen]`
    : `[borttagen ${entityType}]`
  return { id, label, href: null, deleted: true }
}

function fallbackLabelFromPayload(row: ActivityRowLike): string | null {
  const p = (row.new_value ?? row.old_value) as Record<string, unknown> | null
  if (!p) return null
  const candidates = ['title', 'name', 'text', 'law_title', 'subject']
  for (const k of candidates) {
    const v = p[k]
    if (typeof v === 'string' && v.length > 0) return truncate(v)
  }
  return null
}

/**
 * Batch-resolve display names + deep links for every entity referenced by a
 * page of activity rows. One findMany per Prisma model. Workspace-scoped.
 *
 * Returns a map keyed by activity-row id → {primary, secondary?}.
 */
export async function resolveEntityNames(
  rows: ActivityRowLike[],
  workspaceId: string
): Promise<Map<string, ResolveResult>> {
  const taskIds = new Set<string>()
  const listItemIds = new Set<string>()
  const docIds = new Set<string>()
  const requirementIds = new Set<string>()
  const cycleIds = new Set<string>()
  const auditItemIds = new Set<string>()
  const findingIds = new Set<string>()

  const pushById = (entityType: string, id: string) => {
    if (!id) return
    if (entityType === 'task') taskIds.add(id)
    else if (entityType === 'list_item') listItemIds.add(id)
    else if (entityType === 'workspace_document') docIds.add(id)
    else if (entityType === 'requirement') requirementIds.add(id)
    else if (entityType === 'compliance_audit_cycle') cycleIds.add(id)
    else if (entityType === 'compliance_audit_item') auditItemIds.add(id)
    else if (entityType === 'compliance_finding') findingIds.add(id)
  }

  const secondaryByRow = new Map<string, SecondaryRef | null>()
  for (const row of rows) {
    pushById(row.entity_type, row.entity_id)
    const secondary = getSecondaryRef(row)
    secondaryByRow.set(row.id, secondary)
    if (secondary) pushById(secondary.entity_type, secondary.id)
  }

  const [tasks, listItems, docs, requirements, cycles, auditItems, findings] =
    await Promise.all([
      taskIds.size
        ? prisma.task.findMany({
            where: { id: { in: [...taskIds] }, workspace_id: workspaceId },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      listItemIds.size
        ? prisma.lawListItem.findMany({
            where: {
              id: { in: [...listItemIds] },
              law_list: { workspace_id: workspaceId },
            },
            select: {
              id: true,
              document: { select: { title: true, document_number: true } },
            },
          })
        : Promise.resolve([]),
      docIds.size
        ? prisma.workspaceDocument.findMany({
            where: { id: { in: [...docIds] }, workspace_id: workspaceId },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      requirementIds.size
        ? prisma.lawListItemRequirement.findMany({
            where: {
              id: { in: [...requirementIds] },
              list_item: { law_list: { workspace_id: workspaceId } },
            },
            select: { id: true, text: true, list_item_id: true },
          })
        : Promise.resolve([]),
      // Story 21.13: compliance-audit entities.
      cycleIds.size
        ? prisma.complianceAuditCycle.findMany({
            where: { id: { in: [...cycleIds] }, workspace_id: workspaceId },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      auditItemIds.size
        ? prisma.complianceAuditItem.findMany({
            where: {
              id: { in: [...auditItemIds] },
              cycle: { workspace_id: workspaceId },
            },
            select: {
              id: true,
              cycle_id: true,
              law_list_item: {
                select: {
                  document: { select: { title: true, document_number: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      findingIds.size
        ? prisma.complianceFinding.findMany({
            where: {
              id: { in: [...findingIds] },
              cycle: { workspace_id: workspaceId },
            },
            select: { id: true, cycle_id: true, title: true },
          })
        : Promise.resolve([]),
    ])

  const refFor = (
    entityType: string,
    id: string,
    fallback?: string | null
  ): ResolvedEntityRef => {
    if (entityType === 'task') {
      const hit = tasks.find((t) => t.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      return {
        id,
        label: hit.title,
        href: `/tasks?task=${id}`,
        deleted: false,
      }
    }
    if (entityType === 'list_item') {
      const hit = listItems.find((l) => l.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      const doc = hit.document
      const number = doc?.document_number ? ` (${doc.document_number})` : ''
      return {
        id,
        label: `${doc?.title ?? 'Lag'}${number}`,
        href: `/laglistor?document=${id}`,
        deleted: false,
      }
    }
    if (entityType === 'workspace_document') {
      const hit = docs.find((d) => d.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      return {
        id,
        label: hit.title,
        href: `/workspace/styrdokument/${id}/edit`,
        deleted: false,
      }
    }
    if (entityType === 'requirement') {
      const hit = requirements.find((r) => r.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      return {
        id,
        label: truncate(hit.text),
        href: `/laglistor?document=${hit.list_item_id}`,
        deleted: false,
      }
    }
    // Story 21.13: compliance-audit entities.
    if (entityType === 'compliance_audit_cycle') {
      const hit = cycles.find((c) => c.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      return {
        id,
        label: hit.name,
        href: `/laglistor/kontroller/${id}`,
        deleted: false,
      }
    }
    if (entityType === 'compliance_audit_item') {
      const hit = auditItems.find((i) => i.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      const doc = hit.law_list_item?.document
      if (doc) {
        const number = doc.document_number ? ` (${doc.document_number})` : ''
        return {
          id,
          label: `${doc.title}${number}`,
          href: `/laglistor/kontroller/${hit.cycle_id}#items`,
          deleted: false,
        }
      }
      // Defensive: schema should guarantee law_list_item.document is present,
      // but if seed drift leaves it null, fall back to a generic label.
      return {
        id,
        label: 'Kontrollpost',
        href: `/laglistor/kontroller/${hit.cycle_id}`,
        deleted: false,
      }
    }
    if (entityType === 'compliance_finding') {
      const hit = findings.find((f) => f.id === id)
      if (!hit) return tombstone(entityType, id, fallback)
      return {
        id,
        label: truncate(hit.title),
        href: `/laglistor/kontroller/${hit.cycle_id}#findings`,
        deleted: false,
      }
    }
    // email / comment / evidence / unknown: synthetic, no link
    return {
      id,
      label: fallback ?? `[${entityType}]`,
      href: null,
      deleted: false,
    }
  }

  const result = new Map<string, ResolveResult>()
  for (const row of rows) {
    const fallback = fallbackLabelFromPayload(row)
    const primary = refFor(row.entity_type, row.entity_id, fallback)
    const secondary = secondaryByRow.get(row.id) ?? null
    result.set(row.id, {
      primary,
      ...(secondary
        ? { secondary: refFor(secondary.entity_type, secondary.id) }
        : {}),
    })
  }

  return result
}

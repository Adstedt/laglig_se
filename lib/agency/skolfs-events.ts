/**
 * SKOLFS ChangeEvent emission (Story 9.8, Task 2).
 *
 * The detector cron creates a dedup'd `ChangeEvent` with `ai_summary` and
 * `changed_sections` set IN-DETECTOR (AC 7 — bypasses the SFS-coupled
 * `enrich-amendment-summaries` join, which has no `AmendmentDocument` row for a
 * SKOLFS change). This plays the "crawler" role of the existing SFS flow: the
 * out-of-band re-ingest later calls `detectChanges`, which FINDS this event by
 * `(document_id, amendment_sfs)` and ENRICHES it with the text `diff_summary`.
 *
 * The downstream notify/assessment pipeline is reused unchanged (source-agnostic
 * — keyed on `document_id`, no content_type filter).
 *
 * [Source: lib/sync/change-detection.ts:217-250 (crawler→enrich dedup);
 *  Story 9.8 AC 2/5/7; app/api/cron/notify-amendment-changes NOTIFIABLE_CHANGE_TYPES]
 */

import { ChangeType, ContentType, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SkolfsSignal, SkolfsSignalKind } from './skolfs-change-detection'

/** The `amendment_sfs` dedup key for a signal, e.g. "SKOLFS 2025:449". */
export function skolfsAmendmentSfs(signal: SkolfsSignal): string | null {
  return signal.amendmentSkolfsNo ? `SKOLFS ${signal.amendmentSkolfsNo}` : null
}

/**
 * Map a signal kind to a Prisma `ChangeType`. `UPCOMING_AMENDMENT` requires the
 * Story 9.8 migration (`ChangeType.UPCOMING_AMENDMENT`) to be applied — until
 * then a runtime emit of that value errors at the DB enum, so gate the cron's
 * UPCOMING emission on the migration being deployed.
 */
export function skolfsChangeType(kind: SkolfsSignalKind): ChangeType {
  switch (kind) {
    case 'NEW_LAW':
      return ChangeType.NEW_LAW
    case 'AMENDMENT':
      return ChangeType.AMENDMENT
    case 'REPEAL':
      return ChangeType.REPEAL
    case 'UPCOMING_AMENDMENT':
      return ChangeType.UPCOMING_AMENDMENT
  }
}

export type EmitResult =
  | { status: 'created'; id: string }
  | { status: 'duplicate'; id: string }

/**
 * Minimal Prisma surface the emitter needs — lets the route pass the real
 * client and unit tests pass a fake, without `any`.
 */
export interface SkolfsEventClient {
  changeEvent: {
    findFirst(_args: {
      where: Prisma.ChangeEventWhereInput
      select: { id: true }
    }): Promise<{ id: string } | null>
    create(_args: {
      data: Prisma.ChangeEventUncheckedCreateInput
      select: { id: true }
    }): Promise<{ id: string }>
  }
  legalDocument: {
    update(_args: {
      where: { id: string }
      data: Prisma.LegalDocumentUncheckedUpdateInput
    }): Promise<unknown>
  }
}

/**
 * Create a dedup'd `ChangeEvent` for a SKOLFS signal, with `ai_summary` set
 * in-detector. Idempotent: keyed on `(document_id, amendment_sfs)` (AC 5) — for
 * NEW_LAW/REPEAL (no `amendment_sfs`) it dedups on `(document_id, change_type)`.
 * Also advances the base document's `last_change_*` tracking (parity with the
 * SFS path).
 *
 * @param documentId the existing `LegalDocument.id` the event hangs off
 */
export async function emitSkolfsChangeEvent(
  documentId: string,
  signal: SkolfsSignal,
  client: SkolfsEventClient = prisma
): Promise<EmitResult> {
  const change_type = skolfsChangeType(signal.kind)
  const amendment_sfs = skolfsAmendmentSfs(signal)

  // Dedup (AC 5). amendment_sfs present → key on it; otherwise key on the
  // (document, change_type) pair (one NEW_LAW / REPEAL per doc).
  const where: Prisma.ChangeEventWhereInput = amendment_sfs
    ? { document_id: documentId, amendment_sfs }
    : { document_id: documentId, change_type, amendment_sfs: null }

  const existing = await client.changeEvent.findFirst({
    where,
    select: { id: true },
  })
  if (existing) return { status: 'duplicate', id: existing.id }

  const data: Prisma.ChangeEventUncheckedCreateInput = {
    document_id: documentId,
    content_type: ContentType.AGENCY_REGULATION,
    change_type,
    amendment_sfs,
    // AC 7 — ai_summary set in-detector (carries the effective date + sections
    // for SKOLFS, which the AmendmentDocument-coupled email enrich cannot).
    ai_summary: signal.reason,
    ai_summary_generated_at: new Date(),
  }
  // API `change` string (e.g. "ändr. 5, 6 §§"); enriched with the text diff by
  // the out-of-band re-ingest via detectChanges. Set only when present
  // (exactOptionalPropertyTypes — a present `undefined` key is rejected).
  if (signal.changedSections) {
    data.changed_sections = {
      raw: signal.changedSections,
    } as Prisma.InputJsonValue
  }

  const created = await client.changeEvent.create({
    data,
    select: { id: true },
  })

  await client.legalDocument.update({
    where: { id: documentId },
    data: {
      last_change_type: change_type,
      last_change_ref: amendment_sfs,
      last_change_at: new Date(),
    },
  })

  return { status: 'created', id: created.id }
}

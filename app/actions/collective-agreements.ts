'use server'

/**
 * Story 7.5 + 7.6: Kollektivavtal server actions — upload, list, edit,
 * delete (full cascade) and bulk assignment.
 *
 * `uploadCollectiveAgreement` stores the PDF via the shared upload core
 * (`lib/files/upload-core.ts`, Story 7.6 DUP-001 — one implementation of the
 * dedupe/quota/hash/Storage legs shared with `files.ts#uploadFile`), with
 * category AVTAL. The upload self-queues for RAG ingestion:
 * `extraction_status: PENDING` puts the file in the extract-files cron's
 * batch, whose Story 7.5 seam routes agreement-backed files into
 * COLLECTIVE_AGREEMENT chunks and drives the CollectiveAgreementStatus
 * lifecycle (PENDING → PROCESSING → READY/FAILED).
 *
 * `deleteCollectiveAgreement` (Story 7.6) reverses the whole footprint in
 * order: chunks → agreement (FK `onDelete: SetNull` auto-unassigns employees)
 * → backing WorkspaceFile row → Storage object (fail-safe), with
 * CompanyProfile honesty (flag/name reset or repoint) in the same transaction.
 *
 * Permission model (PO-corrected): mutations are gated `employees:manage`
 * ONLY. Every CompanyProfile write in this module is a scoped in-ctx Prisma
 * update of exactly `has_collective_agreement` / `collective_agreement_name`
 * plus the shared completeness-recompute helper — NOT a call to the
 * `workspace:settings`-gated `updateCompanyProfile` action (HR_MANAGER does
 * not hold that permission).
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { prisma } from '@/lib/prisma'
import {
  withWorkspace,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import {
  BUCKET_NAME,
  PDF_MIME_TYPE,
  stageWorkspaceFileUpload,
  validateUploadFile,
} from '@/lib/files/upload-core'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'
import type {
  CollectiveAgreementStatus,
  PersonelType,
  Prisma,
} from '@prisma/client'

// ============================================================================
// Constants
// ============================================================================

const PERSONALREGISTER_PATH = '/personalregister'
const SETTINGS_PATH = '/settings'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

/**
 * Full read shape for the KollektivavtalManager list — a superset of 7.3's
 * `CollectiveAgreementOption` ({id, name, personel_type, status}). Dates are
 * serialized for the RSC/client boundary (`effective_*` as YYYY-MM-DD).
 */
export interface CollectiveAgreementListItem {
  id: string
  name: string
  personel_type: PersonelType | null
  status: CollectiveAgreementStatus
  effective_from: string | null
  effective_to: string | null
  uploaded_by: string
  created_at: string
  assignedEmployeeCount: number
}

// ============================================================================
// Validation
// ============================================================================

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ogiltigt datum.')

const UploadAgreementFieldsSchema = z
  .object({
    name: z.string().trim().min(1, 'Namn krävs.').max(200, 'Max 200 tecken.'),
    // Typ: Arbetare → ARB, Tjänstemän → TJM, Övrigt → null.
    personel_type: z.enum(['ARB', 'TJM']).nullable(),
    effective_from: isoDate.nullable(),
    effective_to: isoDate.nullable(),
  })
  .refine(
    (v) =>
      !v.effective_from ||
      !v.effective_to ||
      v.effective_from <= v.effective_to,
    {
      message: 'Giltighetsperiodens slutdatum måste vara efter startdatumet.',
      path: ['effective_to'],
    }
  )

// ============================================================================
// Serialization
// ============================================================================

type AgreementRecord = {
  id: string
  name: string
  personel_type: PersonelType | null
  status: CollectiveAgreementStatus
  effective_from: Date | null
  effective_to: Date | null
  uploaded_by: string
  created_at: Date
  _count?: { employees: number }
}

/** Shared select for the full list-item shape (list + post-edit refetch). */
const LIST_ITEM_SELECT = {
  id: true,
  name: true,
  personel_type: true,
  status: true,
  effective_from: true,
  effective_to: true,
  uploaded_by: true,
  created_at: true,
  _count: { select: { employees: true } },
} satisfies Prisma.CollectiveAgreementSelect

/** YYYY-MM-DD (validated) → UTC-midnight DateTime, '' /null → null. */
function toUtcDate(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null
}

function toListItem(record: AgreementRecord): CollectiveAgreementListItem {
  return {
    id: record.id,
    name: record.name,
    personel_type: record.personel_type,
    status: record.status,
    effective_from: record.effective_from
      ? record.effective_from.toISOString().slice(0, 10)
      : null,
    effective_to: record.effective_to
      ? record.effective_to.toISOString().slice(0, 10)
      : null,
    uploaded_by: record.uploaded_by,
    created_at: record.created_at.toISOString(),
    assignedEmployeeCount: record._count?.employees ?? 0,
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Upload a kollektivavtal PDF and create its CollectiveAgreement row.
 * Gated `employees:manage` (BOTH mounts — Settings and HR — call this same
 * action; settings-tab visibility is NOT the permission boundary).
 *
 * FormData contract: `file` (PDF), `name`, optional `personel_type`
 * ('ARB' | 'TJM' | '' → null), optional `effective_from` / `effective_to`
 * (YYYY-MM-DD).
 */
export async function uploadCollectiveAgreement(
  formData: FormData
): Promise<ActionResult<CollectiveAgreementListItem>> {
  try {
    return await withWorkspace(async (ctx) => {
      const { workspaceId, userId } = ctx

      // ── File validation (PDF only, ≤25MB — shared core, Story 7.6) ───────
      const validated = validateUploadFile(formData.get('file'), {
        allowedMimeTypes: [PDF_MIME_TYPE],
        typeError: 'Endast PDF-filer kan laddas upp som kollektivavtal.',
      })
      if (!validated.ok) {
        return { success: false, error: validated.error }
      }
      const file = validated.file

      // ── Field validation ─────────────────────────────────────────────────
      const rawType = (formData.get('personel_type') as string | null) || null
      const parsed = UploadAgreementFieldsSchema.safeParse({
        name: (formData.get('name') as string | null) ?? '',
        personel_type: rawType === 'ARB' || rawType === 'TJM' ? rawType : null,
        effective_from:
          (formData.get('effective_from') as string | null) || null,
        effective_to: (formData.get('effective_to') as string | null) || null,
      })
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Ogiltig indata',
        }
      }
      const fields = parsed.data

      // ── WorkspaceFile path (shared core: dedupe → quota → storage) ───────
      const staged = await stageWorkspaceFileUpload({
        workspaceId,
        file,
        parentFolderId: null,
        duplicateError: 'En fil med samma namn finns redan i Filer.',
      })
      if (!staged.ok) {
        return {
          success: false,
          error: staged.error,
          ...(staged.code ? { code: staged.code } : {}),
        }
      }

      // extraction_status PENDING self-queues the PDF for the extract-files
      // cron; its Story 7.5 seam then ingests it as COLLECTIVE_AGREEMENT chunks.
      await prisma.workspaceFile.create({
        data: {
          id: staged.fileId,
          workspace_id: workspaceId,
          uploaded_by: userId,
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: staged.storagePath,
          category: 'AVTAL',
          extraction_status: staged.extractionStatus,
          content_hash: staged.contentHash,
        },
      })

      // ── CollectiveAgreement row ──────────────────────────────────────────
      const agreement = await prisma.collectiveAgreement.create({
        data: {
          workspace_id: workspaceId,
          name: fields.name,
          personel_type: fields.personel_type,
          workspace_file_id: staged.fileId,
          uploaded_by: userId,
          status: 'PENDING',
          effective_from: toUtcDate(fields.effective_from),
          effective_to: toUtcDate(fields.effective_to),
        },
      })

      // ── First-upload CompanyProfile sync (PO correction) ─────────────────
      // Scoped in-ctx Prisma update of exactly two fields + the shared
      // completeness-recompute helper — NOT the workspace:settings-gated
      // updateCompanyProfile action (HR_MANAGER lacks that permission).
      // Fail-safe: the agreement is already created; a profile-sync error is
      // logged, never turned into an upload failure.
      try {
        await syncCompanyProfileOnFirstUpload(
          workspaceId,
          ctx.workspaceName,
          fields.name
        )
      } catch (error) {
        console.error(
          '[uploadCollectiveAgreement] company-profile sync failed:',
          error
        )
      }

      revalidatePath(PERSONALREGISTER_PATH)
      revalidatePath(SETTINGS_PATH)

      return { success: true, data: toListItem(agreement) }
    }, 'employees:manage')
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[uploadCollectiveAgreement]', error)
    return { success: false, error: 'Kunde inte ladda upp kollektivavtalet.' }
  }
}

/**
 * Sync `CompanyProfile.has_collective_agreement` + `collective_agreement_name`
 * on the workspace's FIRST agreement upload, then recompute
 * `profile_completeness` with the same helper `updateCompanyProfile` uses.
 *
 * Only when `has_collective_agreement` is currently false; an existing
 * `collective_agreement_name` is never overwritten. A missing profile row is
 * lazily created (same convention as `getCompanyProfile`'s upsert), with the
 * flag + name set in the create.
 */
async function syncCompanyProfileOnFirstUpload(
  workspaceId: string,
  workspaceName: string,
  agreementName: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const profile = await tx.companyProfile.findUnique({
      where: { workspace_id: workspaceId },
    })

    if (profile && profile.has_collective_agreement) {
      return // not the first upload — nothing to sync
    }

    const data: Prisma.CompanyProfileUpdateInput = {
      has_collective_agreement: true,
    }
    if (!profile?.collective_agreement_name) {
      data.collective_agreement_name = agreementName
    }

    const updated = profile
      ? await tx.companyProfile.update({
          where: { workspace_id: workspaceId },
          data,
        })
      : await tx.companyProfile.create({
          data: {
            workspace_id: workspaceId,
            company_name: workspaceName,
            has_collective_agreement: true,
            collective_agreement_name: agreementName,
          },
        })

    const score = calculateProfileCompleteness(updated)
    if (score !== updated.profile_completeness) {
      await tx.companyProfile.update({
        where: { workspace_id: workspaceId },
        data: { profile_completeness: score },
      })
    }
  })
}

/**
 * Full agreement list for the KollektivavtalManager (Settings + HR mounts).
 * Gated `employees:view` — superset of 7.3's `getCollectiveAgreements()`
 * option shape (which keeps serving the Personalkort select unchanged).
 */
export async function listCollectiveAgreements(): Promise<
  ActionResult<CollectiveAgreementListItem[]>
> {
  try {
    const agreements = await withWorkspace(
      (ctx) =>
        prisma.collectiveAgreement.findMany({
          where: { workspace_id: ctx.workspaceId },
          orderBy: { name: 'asc' },
          select: LIST_ITEM_SELECT,
        }),
      'employees:view'
    )

    return { success: true, data: agreements.map(toListItem) }
  } catch (error) {
    // Server pages call this in Promise.all — a billing-gate redirect must
    // propagate unchanged (same contract as getCompanyProfile).
    if (isRedirectError(error)) {
      throw error
    }
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[listCollectiveAgreements]', error)
    return { success: false, error: 'Kunde inte hämta kollektivavtal.' }
  }
}

// ============================================================================
// Story 7.6: Edit
// ============================================================================

export interface UpdateCollectiveAgreementInput {
  name: string
  /** 'ARB' | 'TJM' | null (Övrigt). */
  personel_type: PersonelType | null
  /** YYYY-MM-DD or null. */
  effective_from: string | null
  effective_to: string | null
}

/**
 * Edit namn/typ/giltighetsperiod on an agreement. Gated `employees:manage`,
 * verify-then-act + compound-where write (cross-workspace ids rejected).
 *
 * Profile repoint: renaming the agreement whose name is
 * `CompanyProfile.collective_agreement_name` updates the profile name too —
 * same scoped-write + completeness-recompute path as the 7.5 upload sync
 * (never the `workspace:settings`-gated company-profile action).
 */
export async function updateCollectiveAgreement(
  id: string,
  input: UpdateCollectiveAgreementInput
): Promise<ActionResult<CollectiveAgreementListItem>> {
  try {
    return await withWorkspace(async (ctx) => {
      const { workspaceId } = ctx

      const parsed = UploadAgreementFieldsSchema.safeParse(input)
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.issues[0]?.message ?? 'Ogiltig indata',
        }
      }
      const fields = parsed.data

      // Verify-then-act: the agreement must belong to ctx workspace.
      const existing = await prisma.collectiveAgreement.findFirst({
        where: { id, workspace_id: workspaceId },
        select: { id: true, name: true },
      })
      if (!existing) {
        return { success: false, error: 'Kollektivavtalet hittades inte.' }
      }

      await prisma.$transaction(async (tx) => {
        // Compound where — defense in depth on top of the verify above.
        await tx.collectiveAgreement.updateMany({
          where: { id, workspace_id: workspaceId },
          data: {
            name: fields.name,
            personel_type: fields.personel_type,
            effective_from: toUtcDate(fields.effective_from),
            effective_to: toUtcDate(fields.effective_to),
          },
        })

        if (fields.name !== existing.name) {
          await repointCompanyProfileName(tx, workspaceId, {
            fromName: existing.name,
            toName: fields.name,
          })
        }
      })

      const refreshed = await prisma.collectiveAgreement.findFirst({
        where: { id, workspace_id: workspaceId },
        select: LIST_ITEM_SELECT,
      })
      if (!refreshed) {
        return { success: false, error: 'Kollektivavtalet hittades inte.' }
      }

      revalidatePath(PERSONALREGISTER_PATH)
      revalidatePath(SETTINGS_PATH)

      return { success: true, data: toListItem(refreshed) }
    }, 'employees:manage')
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[updateCollectiveAgreement]', error)
    return { success: false, error: 'Kunde inte uppdatera kollektivavtalet.' }
  }
}

/**
 * If the profile's `collective_agreement_name` matches `fromName`, repoint it
 * to `toName` and recompute completeness (7.5's scoped-write path).
 */
async function repointCompanyProfileName(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  { fromName, toName }: { fromName: string; toName: string }
): Promise<void> {
  const profile = await tx.companyProfile.findUnique({
    where: { workspace_id: workspaceId },
  })
  if (!profile || profile.collective_agreement_name !== fromName) return

  const updated = await tx.companyProfile.update({
    where: { workspace_id: workspaceId },
    data: { collective_agreement_name: toName },
  })
  const score = calculateProfileCompleteness(updated)
  if (score !== updated.profile_completeness) {
    await tx.companyProfile.update({
      where: { workspace_id: workspaceId },
      data: { profile_completeness: score },
    })
  }
}

// ============================================================================
// Story 7.6: Delete (full cascade)
// ============================================================================

/**
 * Delete an agreement and its whole footprint. Gated `employees:manage`,
 * verify-then-act. Order (Dev Notes): chunks → agreement (FK `onDelete:
 * SetNull` auto-unassigns employees) → backing WorkspaceFile row → Storage
 * object. The DB legs plus the profile-honesty sync run in ONE transaction;
 * the Storage-object removal is fail-safe (an orphaned blob is a cleanup
 * nuisance — a half-deleted agreement would be a bug).
 *
 * The backing file is deleted deliberately (SM/PO decision): it was created
 * by the CA upload flow and 7.5's root-folder filename dedupe would otherwise
 * block re-uploading the same PDF.
 */
export async function deleteCollectiveAgreement(
  id: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async (ctx) => {
      const { workspaceId } = ctx

      const agreement = await prisma.collectiveAgreement.findFirst({
        where: { id, workspace_id: workspaceId },
        select: { id: true, name: true, workspace_file_id: true },
      })
      if (!agreement) {
        return { success: false, error: 'Kollektivavtalet hittades inte.' }
      }

      // Workspace-verified read of the backing file; the storage path is
      // captured for the post-commit object removal.
      const backingFile = agreement.workspace_file_id
        ? await prisma.workspaceFile.findFirst({
            where: {
              id: agreement.workspace_file_id,
              workspace_id: workspaceId,
            },
            select: { id: true, storage_path: true },
          })
        : null

      await prisma.$transaction(async (tx) => {
        // 1) De-index chunks FIRST — the agent must never retrieve a deleted
        //    agreement's content. Filter includes BOTH source_id and
        //    workspace_id (defense in depth; mirrors files.ts' USER_FILE
        //    cleanup precedent).
        await tx.contentChunk.deleteMany({
          where: {
            source_type: 'COLLECTIVE_AGREEMENT',
            source_id: agreement.id,
            workspace_id: workspaceId,
          },
        })

        // 2) The agreement — employees auto-unassign via FK onDelete: SetNull.
        await tx.collectiveAgreement.delete({ where: { id: agreement.id } })

        // 3) The backing WorkspaceFile row (frees the root-folder filename).
        if (backingFile) {
          await tx.workspaceFile.delete({ where: { id: backingFile.id } })
        }

        // 4) Profile honesty (runs after the delete so the remaining-agreement
        //    read reflects it — same scoped-write path as 7.5).
        await syncCompanyProfileAfterDelete(tx, workspaceId, agreement.name)
      })

      // 5) Storage object — fail-safe: log, never abort (DB legs committed).
      if (backingFile?.storage_path) {
        try {
          const storageClient = getStorageClient()
          const { error: removeError } = await storageClient.storage
            .from(BUCKET_NAME)
            .remove([backingFile.storage_path])
          if (removeError) {
            console.error(
              '[deleteCollectiveAgreement] storage remove failed:',
              removeError
            )
          }
        } catch (error) {
          console.error(
            '[deleteCollectiveAgreement] storage remove failed:',
            error
          )
        }
      }

      revalidatePath(PERSONALREGISTER_PATH)
      revalidatePath(SETTINGS_PATH)

      return { success: true }
    }, 'employees:manage')
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[deleteCollectiveAgreement]', error)
    return { success: false, error: 'Kunde inte ta bort kollektivavtalet.' }
  }
}

/**
 * Profile-sync honesty after a delete (AC 3): if no agreements remain →
 * `has_collective_agreement = false` + name null; if the deleted agreement's
 * name matches the profile name → repoint to a remaining agreement's name
 * (first by name, same order as the list). Completeness recomputed with the
 * shared helper. Runs inside the delete transaction.
 */
async function syncCompanyProfileAfterDelete(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  deletedName: string
): Promise<void> {
  const profile = await tx.companyProfile.findUnique({
    where: { workspace_id: workspaceId },
  })
  if (!profile) return

  const remaining = await tx.collectiveAgreement.findMany({
    where: { workspace_id: workspaceId },
    orderBy: { name: 'asc' },
    select: { name: true },
    take: 1,
  })

  let data: Prisma.CompanyProfileUpdateInput | null = null
  if (remaining.length === 0) {
    if (
      profile.has_collective_agreement ||
      profile.collective_agreement_name !== null
    ) {
      data = {
        has_collective_agreement: false,
        collective_agreement_name: null,
      }
    }
  } else if (profile.collective_agreement_name === deletedName) {
    data = { collective_agreement_name: remaining[0]!.name }
  }
  if (!data) return

  const updated = await tx.companyProfile.update({
    where: { workspace_id: workspaceId },
    data,
  })
  const score = calculateProfileCompleteness(updated)
  if (score !== updated.profile_completeness) {
    await tx.companyProfile.update({
      where: { workspace_id: workspaceId },
      data: { profile_completeness: score },
    })
  }
}

// ============================================================================
// Story 7.6: Bulk assignment (Fortnox "Avtal för löner" semantics)
// ============================================================================

const BulkAssignTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personel_type'), value: z.enum(['ARB', 'TJM']) }),
  z.object({ kind: z.literal('group'), groupId: z.string().min(1) }),
])

export type BulkAssignTarget = z.infer<typeof BulkAssignTargetSchema>

/**
 * Resolve a validated bulk target to a workspace-scoped Employee filter.
 * Group targets are ownership-verified — a cross-workspace groupId is
 * rejected, never silently matched to zero rows.
 */
async function resolveBulkTargetWhere(
  workspaceId: string,
  target: BulkAssignTarget
): Promise<{ where: Prisma.EmployeeWhereInput } | { error: string }> {
  if (target.kind === 'group') {
    const group = await prisma.employeeGroup.findFirst({
      where: { id: target.groupId, workspace_id: workspaceId },
      select: { id: true },
    })
    if (!group) return { error: 'Gruppen hittades inte.' }
    return { where: { workspace_id: workspaceId, group_id: group.id } }
  }
  return { where: { workspace_id: workspaceId, personel_type: target.value } }
}

/**
 * Preview how many employees a bulk assignment would target — the SAME
 * compound filter the mutation uses, so the "Tilldelar X anställda" guardrail
 * can never disagree with the write. Gated `employees:manage` (it exists only
 * to arm the bulk-assign confirm).
 */
export async function previewBulkAssignCount(
  target: BulkAssignTarget
): Promise<ActionResult<{ count: number }>> {
  try {
    return await withWorkspace(async (ctx) => {
      const parsed = BulkAssignTargetSchema.safeParse(target)
      if (!parsed.success) {
        return { success: false, error: 'Ogiltig indata' }
      }
      const resolved = await resolveBulkTargetWhere(
        ctx.workspaceId,
        parsed.data
      )
      if ('error' in resolved) {
        return { success: false, error: resolved.error }
      }
      const count = await prisma.employee.count({ where: resolved.where })
      return { success: true, data: { count } }
    }, 'employees:manage')
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[previewBulkAssignCount]', error)
    return { success: false, error: 'Kunde inte beräkna antalet anställda.' }
  }
}

/**
 * Assign an agreement to all employees matching the target (by Personaltyp or
 * by EmployeeGroup). Gated `employees:manage`. Overwrites existing
 * assignments for the targeted employees — deliberate Fortnox semantics
 * (AC 2); the preview count is the guardrail. Both the agreement AND a group
 * target must belong to ctx workspace.
 */
export async function assignCollectiveAgreementBulk(
  agreementId: string,
  target: BulkAssignTarget
): Promise<ActionResult<{ assigned: number }>> {
  try {
    return await withWorkspace(async (ctx) => {
      const { workspaceId } = ctx

      const parsed = BulkAssignTargetSchema.safeParse(target)
      if (!parsed.success) {
        return { success: false, error: 'Ogiltig indata' }
      }

      const agreement = await prisma.collectiveAgreement.findFirst({
        where: { id: agreementId, workspace_id: workspaceId },
        select: { id: true },
      })
      if (!agreement) {
        return { success: false, error: 'Kollektivavtalet hittades inte.' }
      }

      const resolved = await resolveBulkTargetWhere(workspaceId, parsed.data)
      if ('error' in resolved) {
        return { success: false, error: resolved.error }
      }

      // Compound workspace filter on the write itself (defense in depth).
      const result = await prisma.employee.updateMany({
        where: resolved.where,
        data: { collective_agreement_id: agreement.id },
      })

      revalidatePath(PERSONALREGISTER_PATH)
      revalidatePath(SETTINGS_PATH)

      return { success: true, data: { assigned: result.count } }
    }, 'employees:manage')
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return { success: false, error: 'Åtkomst nekad' }
    }
    console.error('[assignCollectiveAgreementBulk]', error)
    return { success: false, error: 'Kunde inte tilldela kollektivavtalet.' }
  }
}

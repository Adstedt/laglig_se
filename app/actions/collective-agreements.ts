'use server'

/**
 * Story 7.5: Kollektivavtal upload + list server actions.
 *
 * `uploadCollectiveAgreement` stores the PDF via the established WorkspaceFile
 * path (category AVTAL, bucket workspace-files, quota + dedupe checks — the
 * storage logic is a scoped re-implementation of `app/actions/files.ts#uploadFile`
 * rather than a call to it: that action reads its own FormData contract,
 * revalidates `/filer`, and returns the heavy links shape; and `files.ts` is
 * outside this story's file boundary so no helper could be extracted from it.
 * Constants and semantics are kept identical — see the Dev Agent Record).
 *
 * The upload self-queues for RAG ingestion: `extraction_status: PENDING` puts
 * the file in the extract-files cron's batch, whose Story 7.5 seam routes
 * agreement-backed files into COLLECTIVE_AGREEMENT chunks and drives the
 * CollectiveAgreementStatus lifecycle (PENDING → PROCESSING → READY/FAILED).
 *
 * Permission model (PO-corrected): mutations are gated `employees:manage`
 * ONLY. The first-upload CompanyProfile sync is a scoped in-ctx Prisma update
 * of exactly `has_collective_agreement` + `collective_agreement_name` plus the
 * shared completeness-recompute helper — NOT a call to the
 * `workspace:settings`-gated `updateCompanyProfile` action (HR_MANAGER does
 * not hold that permission).
 */

import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'
import { z } from 'zod'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { prisma } from '@/lib/prisma'
import {
  withWorkspace,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import {
  assertWithinStorageQuota,
  formatBytesSwedish,
  StorageQuotaExceededError,
} from '@/lib/usage/storage'
import { isExtractableMimeType } from '@/lib/documents/extractable-mime'
import { calculateProfileCompleteness } from '@/lib/profile-completeness'
import type {
  CollectiveAgreementStatus,
  PersonelType,
  Prisma,
} from '@prisma/client'

// ============================================================================
// Constants (mirrors app/actions/files.ts#uploadFile — kept identical)
// ============================================================================

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const BUCKET_NAME = 'workspace-files'
const PDF_MIME_TYPE = 'application/pdf'

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

      // ── File validation (PDF only, ≤25MB) ────────────────────────────────
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return { success: false, error: 'Ingen fil vald' }
      }
      if (file.type !== PDF_MIME_TYPE) {
        return {
          success: false,
          error: 'Endast PDF-filer kan laddas upp som kollektivavtal.',
        }
      }
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: 'Filen är för stor (max 25MB)' }
      }

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

      // ── WorkspaceFile path (mirrors uploadFile: dedupe → quota → storage) ─
      const existingFile = await prisma.workspaceFile.findFirst({
        where: {
          workspace_id: workspaceId,
          parent_folder_id: null,
          filename: file.name,
        },
        select: { id: true },
      })
      if (existingFile) {
        return {
          success: false,
          error: 'En fil med samma namn finns redan i Filer.',
        }
      }

      try {
        await assertWithinStorageQuota(workspaceId, file.size)
      } catch (error) {
        if (error instanceof StorageQuotaExceededError) {
          return {
            success: false,
            error: `Lagringsgräns uppnådd. Du har använt ${formatBytesSwedish(error.currentBytes)} av ${formatBytesSwedish(error.limitBytes)}. Filen kunde inte laddas upp. Frigör utrymme eller uppgradera planen.`,
            code: 'STORAGE_QUOTA_EXCEEDED',
          }
        }
        throw error
      }

      const fileId = crypto.randomUUID()
      const safeFileName = file.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
      const storagePath = `${workspaceId}/files/${fileId}/${safeFileName}`

      const buffer = Buffer.from(await file.arrayBuffer())
      const contentHash = createHash('sha256').update(buffer).digest('hex')

      const storageClient = getStorageClient()
      const { error: uploadError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })
      if (uploadError) {
        console.error('[uploadCollectiveAgreement] storage error:', uploadError)
        return { success: false, error: 'Kunde inte ladda upp filen' }
      }

      // extraction_status PENDING self-queues the PDF for the extract-files
      // cron; its Story 7.5 seam then ingests it as COLLECTIVE_AGREEMENT chunks.
      await prisma.workspaceFile.create({
        data: {
          id: fileId,
          workspace_id: workspaceId,
          uploaded_by: userId,
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          category: 'AVTAL',
          extraction_status: isExtractableMimeType(file.type)
            ? 'PENDING'
            : 'UNSUPPORTED',
          content_hash: contentHash,
        },
      })

      // ── CollectiveAgreement row ──────────────────────────────────────────
      const agreement = await prisma.collectiveAgreement.create({
        data: {
          workspace_id: workspaceId,
          name: fields.name,
          personel_type: fields.personel_type,
          workspace_file_id: fileId,
          uploaded_by: userId,
          status: 'PENDING',
          effective_from: fields.effective_from
            ? new Date(`${fields.effective_from}T00:00:00.000Z`)
            : null,
          effective_to: fields.effective_to
            ? new Date(`${fields.effective_to}T00:00:00.000Z`)
            : null,
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
          select: {
            id: true,
            name: true,
            personel_type: true,
            status: true,
            effective_from: true,
            effective_to: true,
            uploaded_by: true,
            created_at: true,
            _count: { select: { employees: true } },
          },
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

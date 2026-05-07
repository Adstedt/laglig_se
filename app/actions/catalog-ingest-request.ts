'use server'

/**
 * Story 24.1: skeleton stubs for the Epic 24 catalog-ingest queue.
 * Story 24.5: full admin-queue + fulfilment loop wired up here.
 *
 * Admin-permission pattern mirrors `app/actions/admin-workspaces.ts`:
 * `getAdminSession()` from lib/admin/auth before any work; map the admin
 * email to a real `User.id` for the activity-log writer.
 *
 * Cross-cutting Epic 24 conventions (PO-ratified per Story 24.1 QA gate):
 *   1. Activity-log keys use dot notation (`catalog_request.fulfilled`,
 *      `catalog_request.rejected`).
 *   2. RLS is ENABLE-only — admin actions get cross-workspace access via
 *      Prisma's BYPASSRLS role; `getAdminSession()` is the only auth gate.
 *      Workspace isolation is application-layer for non-admin paths only.
 */

import { CatalogRequestStatus, RowMatchStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/services/activity-logger'
import { sendEmail } from '@/lib/email/email-service'
import CatalogRequestFulfilledEmail from '@/emails/catalog-request-fulfilled'
import {
  FulfillCatalogRequestSchema,
  ListCatalogRequestsSchema,
  RejectCatalogRequestSchema,
  type FulfillCatalogRequestInput,
  type ListCatalogRequestsInput,
  type RejectCatalogRequestInput,
} from '@/lib/validation/law-list-import'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface CatalogRequestRow {
  id: string
  status: CatalogRequestStatus
  created_at: Date
  fulfilled_at: Date | null
  rejected_at: Date | null
  admin_note: string | null
  /** Workspace that owns the originating import. */
  workspace: { id: string; name: string }
  /** User who originally clicked "Begär tillägg". */
  requested_by: { id: string; name: string | null; email: string }
  /** Ops user who claimed/fulfilled (when status != PENDING). */
  handler: { id: string; name: string | null; email: string } | null
  /** Originating row's source data — surfaces in the detail panel. */
  import_row: {
    id: string
    source_titel: string | null
    source_sfs_nummer: string | null
    source_omrade: string | null
    source_lagansvarig: string | null
    source_kommentar: string | null
  }
  /** The import the row belongs to. */
  import: {
    id: string
    filename: string
    created_at: Date
  }
  /** When status=FULFILLED, the LegalDocument ops ingested. */
  fulfilled_with_document: {
    id: string
    title: string
    document_number: string
  } | null
}

export interface ListCatalogRequestsResult {
  requests: CatalogRequestRow[]
  /** Counts across the full window, regardless of `status` filter. */
  counts: {
    pending: number
    fulfilled: number
    rejected: number
    breached: number // PENDING + age > 24h
    total: number
  }
}

const SLA_BREACH_HOURS = 24

// ============================================================================
// Helper: resolve admin email → User row for activity-log attribution
// ============================================================================

async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const session = await getAdminSession()
  if (!session) return null
  const user = await prisma.user.findFirst({
    where: { email: session.email },
    select: { id: true, email: true },
  })
  return user
}

// ============================================================================
// listPendingCatalogRequests (Story 24.5)
// ============================================================================

export async function listPendingCatalogRequests(
  input: Partial<ListCatalogRequestsInput> = {}
): Promise<ActionResult<ListCatalogRequestsResult>> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Ej autentiserad' }

  const parsed = ListCatalogRequestsSchema.safeParse({
    status: input.status ?? 'pending',
    rangeDays: input.rangeDays ?? 30,
  })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  const cutoff = new Date(
    Date.now() - parsed.data.rangeDays * 24 * 60 * 60 * 1000
  )

  // Build the status filter — admin sees ALL workspaces' requests (BYPASSRLS).
  const statusFilter =
    parsed.data.status === 'pending'
      ? CatalogRequestStatus.PENDING
      : parsed.data.status === 'fulfilled'
        ? CatalogRequestStatus.FULFILLED
        : parsed.data.status === 'rejected'
          ? CatalogRequestStatus.REJECTED
          : undefined

  try {
    const [requests, allInWindow] = await Promise.all([
      prisma.catalogIngestRequest.findMany({
        where: {
          created_at: { gte: cutoff },
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        // Sort by age ascending (oldest first → SLA-breach surfaces at top)
        orderBy: [{ created_at: 'asc' }, { import_row_id: 'asc' }],
        include: {
          workspace: { select: { id: true, name: true } },
          requested_by: { select: { id: true, name: true, email: true } },
          handler: { select: { id: true, name: true, email: true } },
          fulfilled_with_document: {
            select: { id: true, title: true, document_number: true },
          },
          import_row: {
            select: {
              id: true,
              source_titel: true,
              source_sfs_nummer: true,
              source_omrade: true,
              source_lagansvarig: true,
              source_kommentar: true,
              import: {
                select: { id: true, filename: true, created_at: true },
              },
            },
          },
        },
      }),
      prisma.catalogIngestRequest.findMany({
        where: { created_at: { gte: cutoff } },
        select: { status: true, created_at: true },
      }),
    ])

    const breachCutoff = new Date(
      Date.now() - SLA_BREACH_HOURS * 60 * 60 * 1000
    )
    const counts = {
      pending: 0,
      fulfilled: 0,
      rejected: 0,
      breached: 0,
      total: allInWindow.length,
    }
    for (const r of allInWindow) {
      if (r.status === CatalogRequestStatus.PENDING) {
        counts.pending++
        if (r.created_at < breachCutoff) counts.breached++
      } else if (r.status === CatalogRequestStatus.FULFILLED) {
        counts.fulfilled++
      } else if (r.status === CatalogRequestStatus.REJECTED) {
        counts.rejected++
      }
    }

    const rows: CatalogRequestRow[] = requests.map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      fulfilled_at: r.fulfilled_at,
      rejected_at: r.rejected_at,
      admin_note: r.admin_note,
      workspace: r.workspace,
      requested_by: r.requested_by,
      handler: r.handler,
      import_row: {
        id: r.import_row.id,
        source_titel: r.import_row.source_titel,
        source_sfs_nummer: r.import_row.source_sfs_nummer,
        source_omrade: r.import_row.source_omrade,
        source_lagansvarig: r.import_row.source_lagansvarig,
        source_kommentar: r.import_row.source_kommentar,
      },
      import: r.import_row.import,
      fulfilled_with_document: r.fulfilled_with_document,
    }))

    return { success: true, data: { requests: rows, counts } }
  } catch (err) {
    console.error('listPendingCatalogRequests error:', err)
    return {
      success: false,
      error: 'Kunde inte hämta katalogtilläggsförfrågningar',
    }
  }
}

// ============================================================================
// fulfillCatalogRequest (Story 24.5)
// ============================================================================

export async function fulfillCatalogRequest(
  input: FulfillCatalogRequestInput
): Promise<ActionResult> {
  const adminUser = await getAdminUser()
  if (!adminUser) return { success: false, error: 'Ej autentiserad' }

  const parsed = FulfillCatalogRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    // Load the request + verify the legal document — both up-front so we can
    // bail with a clean error before opening the transaction.
    const request = await prisma.catalogIngestRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        import_row: {
          include: {
            import: {
              include: {
                committed_law_list: { select: { id: true, name: true } },
              },
            },
          },
        },
        requested_by: { select: { id: true, name: true, email: true } },
      },
    })
    if (!request) {
      return { success: false, error: 'Förfrågan hittades inte' }
    }

    // Idempotency: re-fulfilling a FULFILLED request is a no-op success.
    // Don't re-email.
    if (request.status === CatalogRequestStatus.FULFILLED) {
      return { success: true }
    }
    if (request.status !== CatalogRequestStatus.PENDING) {
      return {
        success: false,
        error: 'Endast väntande förfrågningar kan hanteras',
      }
    }

    const legalDocument = await prisma.legalDocument.findUnique({
      where: { id: parsed.data.fulfilledWithDocumentId },
      select: { id: true, title: true, document_number: true },
    })
    if (!legalDocument) {
      return {
        success: false,
        error: 'Inget dokument med det id:t hittades',
      }
    }

    // Single transaction: flip the request + auto-rematch the row.
    await prisma.$transaction(async (tx) => {
      await tx.catalogIngestRequest.update({
        where: { id: request.id },
        data: {
          status: CatalogRequestStatus.FULFILLED,
          handler_user_id: adminUser.id,
          fulfilled_with_document_id: legalDocument.id,
          admin_note: parsed.data.adminNote ?? request.admin_note,
          fulfilled_at: new Date(),
        },
      })
      await tx.lawListImportRow.update({
        where: { id: request.import_row_id },
        data: {
          match_status: RowMatchStatus.CATALOG_REQUEST_FULFILLED,
          matched_document_id: legalDocument.id,
          confidence_score: 1.0,
          match_reasoning: 'Manuellt ingesterat av ops',
        },
      })
    })

    // Activity-log on the originating workspace's timeline (so users see it
    // alongside their own actions, per AC 13 + Dev Notes "Activity log scope").
    await logActivity(
      request.workspace_id,
      adminUser.id,
      'catalog_request',
      request.id,
      'catalog_request.fulfilled',
      null,
      {
        document_title: legalDocument.title,
        document_number: legalDocument.document_number,
        fulfilled_with_document_id: legalDocument.id,
      }
    )

    // Email — fail-safe (don't roll back the fulfilment if email fails).
    try {
      const importStatus = request.import_row.import.status
      const recipient = request.requested_by
      if (recipient.email) {
        const firstName = recipient.name?.split(' ')[0] ?? null
        await sendEmail({
          to: recipient.email,
          subject: `Vi har lagt till ${legalDocument.document_number} i katalogen`,
          react: CatalogRequestFulfilledEmail({
            firstName,
            sourceTitel:
              request.import_row.source_titel ?? request.import_row.id,
            importFilename: request.import_row.import.filename,
            legalDocumentTitle: legalDocument.title,
            legalDocumentNumber: legalDocument.document_number,
            importStatus:
              importStatus === 'COMMITTED'
                ? 'COMMITTED'
                : importStatus === 'AWAITING_REVIEW'
                  ? 'AWAITING_REVIEW'
                  : 'OTHER',
            importId: request.import_row.import.id,
            lawListId: request.import_row.import.committed_law_list?.id ?? null,
            lawListName:
              request.import_row.import.committed_law_list?.name ?? null,
          }),
          from: 'notifications',
        })
      }
    } catch (emailErr) {
      console.error(
        'fulfillCatalogRequest email send failed (non-fatal):',
        emailErr
      )
    }

    revalidatePath('/admin/catalog-requests')
    revalidatePath('/admin/dashboard')
    revalidatePath(`/laglistor/skapa/${request.import_row.import.id}/granska`)
    return { success: true }
  } catch (err) {
    console.error('fulfillCatalogRequest error:', err)
    return { success: false, error: 'Kunde inte hantera förfrågan' }
  }
}

// ============================================================================
// getCatalogRequestPipCount (Story 24.5) — admin sidebar pip
// ============================================================================

export async function getCatalogRequestPipCount(): Promise<
  ActionResult<{ pending: number; breached: number }>
> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Ej autentiserad' }

  try {
    const breachCutoff = new Date(
      Date.now() - SLA_BREACH_HOURS * 60 * 60 * 1000
    )
    const [pending, breached] = await Promise.all([
      prisma.catalogIngestRequest.count({
        where: { status: CatalogRequestStatus.PENDING },
      }),
      prisma.catalogIngestRequest.count({
        where: {
          status: CatalogRequestStatus.PENDING,
          created_at: { lt: breachCutoff },
        },
      }),
    ])
    return { success: true, data: { pending, breached } }
  } catch (err) {
    console.error('getCatalogRequestPipCount error:', err)
    return { success: false, error: 'Kunde inte hämta antalet förfrågningar' }
  }
}

// ============================================================================
// rejectCatalogRequest (Story 24.5)
// ============================================================================

export async function rejectCatalogRequest(
  input: RejectCatalogRequestInput
): Promise<ActionResult> {
  const adminUser = await getAdminUser()
  if (!adminUser) return { success: false, error: 'Ej autentiserad' }

  const parsed = RejectCatalogRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    const request = await prisma.catalogIngestRequest.findUnique({
      where: { id: parsed.data.requestId },
    })
    if (!request) {
      return { success: false, error: 'Förfrågan hittades inte' }
    }

    // Idempotency: re-rejecting a REJECTED request is a no-op.
    if (request.status === CatalogRequestStatus.REJECTED) {
      return { success: true }
    }
    if (request.status !== CatalogRequestStatus.PENDING) {
      return {
        success: false,
        error: 'Endast väntande förfrågningar kan avvisas',
      }
    }

    await prisma.catalogIngestRequest.update({
      where: { id: request.id },
      data: {
        status: CatalogRequestStatus.REJECTED,
        handler_user_id: adminUser.id,
        admin_note: parsed.data.adminNote ?? request.admin_note,
        rejected_at: new Date(),
      },
    })

    // Per AC 21: rejection does NOT auto-flip the originating LawListImportRow.
    // The row stays CATALOG_REQUEST_PENDING from the user's perspective. They
    // can re-decide via the review surface.

    await logActivity(
      request.workspace_id,
      adminUser.id,
      'catalog_request',
      request.id,
      'catalog_request.rejected',
      null,
      {
        admin_note: parsed.data.adminNote ?? null,
      }
    )

    // Per AC 10: NO email sent on rejection.

    revalidatePath('/admin/catalog-requests')
    revalidatePath('/admin/dashboard')
    return { success: true }
  } catch (err) {
    console.error('rejectCatalogRequest error:', err)
    return { success: false, error: 'Kunde inte avvisa förfrågan' }
  }
}

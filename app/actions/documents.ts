'use server'

/**
 * Epic 17 Story 17.1: Workspace Document Server Actions
 * Basic CRUD operations for the Document Management System
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  createDocumentSchema,
  updateDocumentStatusSchema,
  updateDocumentMetadataSchema,
  getWorkspaceDocumentsSchema,
  VALID_STATUS_TRANSITIONS,
  type CreateDocumentInput,
  type UpdateDocumentStatusInput,
  type UpdateDocumentMetadataInput,
  type GetWorkspaceDocumentsInput,
} from '@/lib/validation/documents'
import { WorkspaceDocumentStatus } from '@prisma/client'
import { getStorageClient } from '@/lib/supabase/storage'
import { after } from 'next/server'
import {
  decideReindexOnStatusChange,
  indexWorkspaceDocument,
  deindexWorkspaceDocument,
  markWorkspaceDocumentDirty,
  updateWorkspaceDocumentStatusMetadata,
} from '@/lib/chunks/workspace-document-reindex'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Default empty Tiptap document
const EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

// Helper to extract plaintext from HTML
function extractPlaintext(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BUCKET_NAME = 'workspace-files'

// ============================================================================
// Server Actions
// ============================================================================

export async function createDocument(
  input: CreateDocumentInput
): Promise<ActionResult<{ id: string; title: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const validated = createDocumentSchema.parse(input)

      // If templateId provided, fetch template content
      let contentJson = validated.contentJson ?? EMPTY_TIPTAP_DOC
      let documentType = validated.documentType

      if (validated.templateId) {
        const template = await prisma.workspaceDocumentTemplate.findUnique({
          where: { id: validated.templateId },
        })
        if (!template) {
          return { success: false, error: 'Mall hittades inte' }
        }
        contentJson = template.content_json
        documentType = template.document_type
      }

      // Create document + version v1 in a transaction
      const document = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.create({
          data: {
            workspace_id: workspaceId,
            title: validated.title,
            document_type: documentType,
            document_number: validated.documentNumber ?? null,
            template_id: validated.templateId ?? null,
            created_by: userId,
            current_version_number: 1,
          },
        })

        const version = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: doc.id,
            version_number: 1,
            source: 'TIPTAP',
            content_json: contentJson,
            content_html: '',
            created_by: userId,
          },
        })

        // Story 17.16 AC 11: newly-created doc starts in the never-approved
        // DRAFT state. Populate the alias AND the draft pointer (they point at
        // the same row for never-approved docs — there's no approved version
        // to protect yet) + draft_status='DRAFT' so the new model's "writeable
        // iff current_draft_version_id is set" predicate accepts edits
        // immediately.
        const updated = await tx.workspaceDocument.update({
          where: { id: doc.id },
          data: {
            current_version_id: version.id,
            current_draft_version_id: version.id,
            draft_status: 'DRAFT',
          },
        })

        // ActivityLog: document_created
        await tx.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: doc.id,
            action: 'document_created',
            new_value: { title: validated.title, document_type: documentType },
          },
        })

        return updated
      })

      return {
        success: true,
        data: {
          id: document.id,
          title: document.title,
          versionNumber: 1,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocument(
  documentId: string
): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: {
          id: documentId,
          workspace_id: workspaceId,
        },
        include: {
          current_version: true,
          // Story 17.16 AC 13: dual-pointer versions so the editor route (and
          // other consumers downstream) can pick the right content source
          // explicitly — draft when in progress, else approved. The legacy
          // `current_version` (alias) is kept to avoid breaking the many other
          // consumers of getDocument; Story 17.18 will migrate them.
          current_draft_version: true,
          current_approved_version: true,
          creator: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
          approver: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
          template: {
            select: { id: true, name: true },
          },
          task_links: {
            include: {
              task: { select: { id: true, title: true } },
            },
          },
          list_item_links: {
            include: {
              list_item: {
                select: {
                  id: true,
                  document: {
                    select: { title: true, document_number: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      return { success: true, data: document }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export interface VersionAuthor {
  id: string
  name: string
  avatar_url: string | null
}

export interface DocumentVersionEntry {
  id: string
  version_number: number
  source: string
  change_summary: string | null
  created_by: string
  created_at: Date
  author: VersionAuthor
}

export async function getDocumentVersions(
  documentId: string
): Promise<ActionResult<DocumentVersionEntry[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const versions = await prisma.workspaceDocumentVersion.findMany({
        where: { document_id: documentId },
        orderBy: { version_number: 'desc' },
        select: {
          id: true,
          version_number: true,
          source: true,
          change_summary: true,
          created_by: true,
          created_at: true,
        },
      })

      // Resolve author names (created_by has no FK — separate lookup needed)
      const userIds = [
        ...new Set(
          versions.map((v) => v.created_by).filter((id) => id !== 'agent')
        ),
      ]

      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, avatar_url: true },
            })
          : []

      const userMap = new Map(users.map((u) => [u.id, u]))

      const versionsWithAuthors: DocumentVersionEntry[] = versions.map((v) => {
        const user = userMap.get(v.created_by)
        return {
          ...v,
          author:
            v.created_by === 'agent'
              ? { id: 'agent', name: 'AI-assistent', avatar_url: null }
              : {
                  id: v.created_by,
                  name: user?.name ?? 'Okänd användare',
                  avatar_url: user?.avatar_url ?? null,
                },
        }
      })

      return { success: true, data: versionsWithAuthors }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getWorkspaceDocuments(
  input?: GetWorkspaceDocumentsInput
): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validated = getWorkspaceDocumentsSchema.parse(input ?? {})

      const where: Record<string, unknown> = {
        workspace_id: workspaceId,
      }

      if (validated.type) {
        where.document_type = validated.type
      }
      if (validated.status) {
        // Story 17.17 AC 3 / AC 4 — pointer-aware status filter.
        // APPROVED → match any doc with an approved version (includes the
        // dual-state "APPROVED with draft pending" case).
        // DRAFT / IN_REVIEW → match the draft pointer + matching sub-status
        // (so a dual-state doc shows under BOTH "Godkända" AND "Utkast"
        // filters — by design; the doc IS both).
        // ARCHIVED / SUPERSEDED → terminal top-level status (unchanged).
        switch (validated.status) {
          case 'APPROVED':
            where.current_approved_version_id = { not: null }
            break
          case 'DRAFT':
            where.current_draft_version_id = { not: null }
            where.draft_status = 'DRAFT'
            break
          case 'IN_REVIEW':
            where.current_draft_version_id = { not: null }
            where.draft_status = 'IN_REVIEW'
            break
          case 'ARCHIVED':
          case 'SUPERSEDED':
          default:
            where.status = validated.status
            break
        }
      }
      if (validated.search) {
        where.title = { contains: validated.search, mode: 'insensitive' }
      }

      const sortField = validated.sortBy ?? 'updated_at'
      const sortDirection = validated.sortOrder ?? 'desc'

      const documents = await prisma.workspaceDocument.findMany({
        where,
        take: validated.take + 1, // Fetch one extra to check hasMore
        ...(validated.cursor
          ? { cursor: { id: validated.cursor }, skip: 1 }
          : {}),
        orderBy: { [sortField]: sortDirection },
        select: {
          id: true,
          title: true,
          document_type: true,
          status: true,
          document_number: true,
          current_version_number: true,
          review_date: true,
          created_by: true,
          created_at: true,
          updated_at: true,
          creator: {
            select: { id: true, name: true, email: true },
          },
          // Story 17.17 AC 1 / Task 2 — dual-pointer fields surface the
          // approved/draft state to the styrdokument table so the composite
          // badge can render without a second query. AC 15 (no new server-
          // side queries) still holds: this is a `select` shape extension
          // on the existing `findMany`, not a new query.
          current_approved_version_id: true,
          current_draft_version_id: true,
          draft_status: true,
          current_approved_version: {
            select: { version_number: true, approved_at: true },
          },
          current_draft_version: {
            select: { version_number: true, created_at: true },
          },
        },
      })

      const hasMore = documents.length > validated.take
      const items = hasMore ? documents.slice(0, validated.take) : documents
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return {
        success: true,
        data: { items, hasMore, nextCursor },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Story 17.16 NTH-2 boundary note: this function handles the **never-approved**
 * IN_REVIEW → APPROVED transition (where `current_approved_version_id IS NULL`
 * at the time of approval) plus all non-approval status transitions. The
 * **dual-state** case (a doc that has a prior approved version AND a draft
 * currently in progress) is handled by `promoteDraftToApproved` — that
 * function atomically swaps the pointer slots, stamps version-level audit
 * timestamps, and advances the deprecated `current_version_id` alias.
 *
 * Do NOT use this function to "promote" a draft on a dual-state doc — the
 * pointer swap won't happen and the alias-freeze invariant from AC 4 + AC 5
 * gets violated.
 */
export async function updateDocumentStatus(
  input: UpdateDocumentStatusInput
): Promise<ActionResult<{ id: string; status: WorkspaceDocumentStatus }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const validated = updateDocumentStatusSchema.parse(input)

      const document = await prisma.workspaceDocument.findFirst({
        where: { id: validated.documentId, workspace_id: workspaceId },
        select: { id: true, status: true, workspace_id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Validate status transition
      const allowedTransitions = VALID_STATUS_TRANSITIONS[document.status]
      if (!allowedTransitions.includes(validated.newStatus)) {
        return {
          success: false,
          error: `Ogiltig statusövergång: ${document.status} → ${validated.newStatus}`,
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        status: validated.newStatus,
      }

      if (validated.newStatus === WorkspaceDocumentStatus.APPROVED) {
        updateData.approved_by = userId
        updateData.approved_at = new Date()
      } else if (document.status === WorkspaceDocumentStatus.APPROVED) {
        // Transitioning away from APPROVED — clear approval fields
        updateData.approved_by = null
        updateData.approved_at = null
      }

      const oldStatus = document.status

      const updated = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.update({
          where: { id: document.id },
          data: updateData,
        })

        // ActivityLog: document_status_changed
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_status_changed',
            old_value: { status: oldStatus },
            new_value: {
              status: validated.newStatus,
              comment: validated.comment ?? null,
            },
          },
        })

        return doc
      })

      // Story 17.10b: 3-way status-transition handling. DELETE for terminal
      // states (ARCHIVED / SUPERSEDED), METADATA_UPDATE for the common in-place
      // status changes (cheap UPDATE on chunk.metadata.status, no re-embed),
      // NONE when status didn't actually change. after() so the response isn't
      // blocked; failures are logged, not fatal.
      const reindex = decideReindexOnStatusChange(
        oldStatus,
        validated.newStatus
      )
      if (reindex !== 'NONE') {
        after(async () => {
          try {
            if (reindex === 'DELETE') {
              await deindexWorkspaceDocument(document.id, workspaceId)
            } else {
              await updateWorkspaceDocumentStatusMetadata(
                document.id,
                workspaceId,
                validated.newStatus
              )
            }
          } catch (err) {
            console.error(
              `[updateDocumentStatus] WORKSPACE_DOCUMENT ${reindex} failed for ${document.id} — retryable:`,
              err instanceof Error ? err.message : err
            )
          }
        })
      }

      return {
        success: true,
        data: { id: updated.id, status: updated.status },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Get Latest Status Change Comment
// ============================================================================

export async function getLatestStatusComment(documentId: string): Promise<{
  comment: string
  userName: string
  fromStatus: string
  toStatus: string
  createdAt: string
} | null> {
  try {
    const entry = await prisma.activityLog.findFirst({
      where: {
        entity_type: 'workspace_document',
        entity_id: documentId,
        action: 'document_status_changed',
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (!entry) return null

    const newValue = entry.new_value as Record<string, unknown> | null
    const oldValue = entry.old_value as Record<string, unknown> | null
    const comment = (newValue?.comment as string) ?? ''

    if (!comment) return null

    return {
      comment,
      userName:
        (entry.user?.name as string) ??
        (entry.user?.email as string) ??
        'Okänd',
      fromStatus: (oldValue?.status as string) ?? '',
      toStatus: (newValue?.status as string) ?? '',
      createdAt: entry.created_at.toISOString(),
    }
  } catch {
    return null
  }
}

// ============================================================================
// Story 17.2: Save Document Version
// ============================================================================

/**
 * Autosave: updates the current draft version's content in place (no new
 * version number).
 *
 * Story 17.16 AC 13 / Task 8 (load-bearing): targets the **draft pointer**
 * when set, NEVER the deprecated `current_version_id` alias. Under the
 * corrected Model B semantics, the alias is frozen on the approved version
 * during a draft window — writing to the alias would silently overwrite
 * approved content with draft edits (a data-loss class bug surfaced during
 * Story 17.16 live smoke).
 *
 * Target version selection:
 *   1. `current_draft_version_id` if set (the normal draft-active path)
 *   2. `current_approved_version_id` if set (never-approved DRAFT — the
 *      doc's only version row IS the approved-and-draft target; same as
 *      saveDocumentVersion Path B's alias semantics)
 *   3. `current_version_id` fallback (defensive; should not be reachable
 *      post-backfill)
 *
 * Refuses if the doc is APPROVED with no draft in progress — editor autosave
 * should never reach this state under Model B (the editor only opens for
 * docs that have a draft pointer set), but defensive guard catches any future
 * regression.
 */
export async function autosaveDocument(
  documentId: string,
  contentJson: object,
  title?: string,
  contentHtml?: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_id: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Story 17.16 AC 13: refuse autosave against APPROVED-no-draft. The
      // editor shouldn't reach this state, but defensive guard prevents any
      // future regression where autosave fires before branching.
      if (
        document.current_draft_version_id == null &&
        document.status === WorkspaceDocumentStatus.APPROVED
      ) {
        return {
          success: false,
          error:
            'Det godkända dokumentet kan inte ändras direkt. Skapa ett utkast först.',
        }
      }

      // Target the draft pointer when set; else approved pointer (never-
      // approved DRAFT case); else the alias as a defensive fallback.
      const targetVersionId =
        document.current_draft_version_id ??
        document.current_approved_version_id ??
        document.current_version_id

      if (!targetVersionId) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const html = contentHtml ?? ''
      const extractedText = extractPlaintext(html)

      await prisma.workspaceDocumentVersion.update({
        where: { id: targetVersionId },
        data: {
          content_json: contentJson as never,
          content_html: html,
          extracted_text: extractedText,
        },
      })

      if (title !== undefined) {
        await prisma.workspaceDocument.update({
          where: { id: document.id },
          data: { title },
        })
      }

      // Story 17.10b: mark dirty for the cron sweep to re-index after the
      // DRAFT_REINDEX_DEBOUNCE_MS idle window. Helper skips terminal-state docs
      // (ARCHIVED/SUPERSEDED) and is workspace-scoped per AC 28. Fire-and-forget
      // via after() so the autosave response stays fast; failures are logged.
      after(async () => {
        try {
          await markWorkspaceDocumentDirty(document.id, workspaceId)
        } catch (err) {
          console.error(
            `[autosaveDocument] mark-dirty failed for ${document.id} — retryable:`,
            err instanceof Error ? err.message : err
          )
        }
      })

      return {
        success: true,
        data: {
          id: targetVersionId,
          versionNumber: document.current_version_number,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Explicit save: creates a new version with incremented version number.
 *
 * Story 17.16 AC 5 — three-path routing under Model B (dual-pointer):
 *
 *   - **Path A** (`current_draft_version_id IS NOT NULL`) — draft in progress.
 *     New version row created; `current_draft_version_id` + `current_version_number`
 *     advance; **`current_version_id` (deprecated alias) STAYS FROZEN** on the
 *     approved version so the 17.10b auto-reindex keeps grounding `[Källa:]` in
 *     approved content. `current_approved_version_id` and `status` are not
 *     touched.
 *
 *   - **Path B** (`current_draft_version_id IS NULL` AND status ∈ DRAFT/IN_REVIEW
 *     AND `current_approved_version_id IS NULL`) — never-approved doc. Today's
 *     legacy flow: alias and draft pointer advance together (same value — there's
 *     no approved version to protect).
 *
 *   - **Path C** (`current_draft_version_id IS NULL` AND status = APPROVED) —
 *     defensive refusal. Editor autosave should never target an APPROVED-no-draft
 *     doc directly; the user must branch a draft first via `createDraftFromApproved`.
 */
export async function saveDocumentVersion(
  documentId: string,
  contentJson: object,
  changeSummary?: string,
  title?: string,
  contentHtml?: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          workspace_id: true,
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Story 17.16 AC 5: Path C — defensive guard against editor autosave
      // accidentally targeting an APPROVED-no-draft doc directly. Under Model B,
      // the only way to edit an APPROVED doc is to branch a draft first via
      // createDraftFromApproved.
      if (
        document.current_draft_version_id == null &&
        document.status === WorkspaceDocumentStatus.APPROVED
      ) {
        return {
          success: false,
          error:
            'Det godkända dokumentet kan inte ändras direkt. Skapa ett utkast först.',
        }
      }

      const html = contentHtml ?? ''
      const extractedText = extractPlaintext(html)

      const newVersionNumber = document.current_version_number + 1

      // Story 17.16 AC 5: Path A advances the draft pointer only (alias frozen
      // on approved); Path B advances the alias too (never-approved doc — no
      // approved to protect).
      const isDraftInProgress = document.current_draft_version_id != null

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: contentJson as never,
            content_html: html,
            extracted_text: extractedText,
            change_summary: changeSummary ?? null,
            created_by: userId,
          },
        })

        const docUpdate: Record<string, unknown> = {
          current_version_number: newVersionNumber,
          // Path A: only advance the draft pointer. Alias stays on approved.
          // Path B: advance both alias and draft pointer (same target — they
          // already point at the same row for never-approved docs).
          current_draft_version_id: ver.id,
        }
        if (!isDraftInProgress) {
          // Path B (never-approved DRAFT/IN_REVIEW): advance the deprecated
          // alias too, matching today's legacy behavior. For Path A, the alias
          // is FROZEN on the approved version per Story 17.16 AC 4 + AC 11.
          docUpdate.current_version_id = ver.id
        }
        if (title !== undefined) {
          docUpdate.title = title
        }

        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: docUpdate,
        })

        // ActivityLog: document_version_saved
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_version_saved',
            new_value: {
              version_number: newVersionNumber,
              change_summary: changeSummary ?? null,
            },
          },
        })

        return ver
      })

      // Story 17.10b: explicit checkpoint = real content change = embed now.
      // Skip for non-indexable terminal states (ARCHIVED / SUPERSEDED — checkpointing
      // those would be unusual but defensive). after() so the response isn't blocked;
      // hash-gated inside syncWorkspaceChunks so a no-op content change is free.
      after(async () => {
        try {
          await indexWorkspaceDocument(document.id, document.workspace_id)
        } catch (err) {
          console.error(
            `[saveDocumentVersion] WORKSPACE_DOCUMENT reindex failed for ${document.id} — retryable:`,
            err instanceof Error ? err.message : err
          )
        }
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.3: Get Document Version Content (for diff view)
// ============================================================================

export async function getDocumentVersionContent(
  documentId: string,
  versionId: string
): Promise<ActionResult<{ extracted_text: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const version = await prisma.workspaceDocumentVersion.findFirst({
        where: { id: versionId, document_id: documentId },
        select: { extracted_text: true },
      })

      if (!version) {
        return { success: false, error: 'Version hittades inte' }
      }

      return {
        success: true,
        data: { extracted_text: version.extracted_text ?? '' },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.3: Restore Document Version
// ============================================================================

/**
 * Restore an old version's content as a new current version.
 *
 * Story 17.16 QA CONCERN-001 fix (2026-06-04): Made Model B-aware. The legacy
 * implementation advanced `current_version_id` (deprecated alias) on every
 * restore, which under the corrected Model B alias-freeze semantics could
 * silently leak historical content into the approved-tier index when a user
 * restored an old version while a dual-state draft was in progress — exact
 * same class of bug as the autosaveDocument alias-leak surfaced during the
 * Story 17.16 live smoke.
 *
 * The fix mirrors `saveDocumentVersion`'s three-path routing exactly:
 *
 *   - **Path A** (`current_draft_version_id IS NOT NULL`) — restore creates a
 *     new version, advances the draft pointer, alias frozen. The user can
 *     "roll back the draft" to historical content without affecting the
 *     approved baseline.
 *
 *   - **Path B** (never-approved DRAFT) — legacy behavior. Alias and draft
 *     pointer advance together. No approved version to protect.
 *
 *   - **Path C** (APPROVED with no draft) — refusal. Restore semantically
 *     means "make this old content the current effective content" — under
 *     Model B that requires a draft cycle (createDraftFromApproved → restore
 *     into the draft → promote). Refuse with the same Swedish error as
 *     `saveDocumentVersion` Path C to guide the user.
 *
 *   - **Path D** (ARCHIVED/SUPERSEDED) — refusal. Restore on terminal-state
 *     docs is meaningless; the doc is out of active editing.
 */
export async function restoreDocumentVersion(
  documentId: string,
  versionNumber: number
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Story 17.16 QA-fix: read the dual-pointer fields so the path routing
      // below can decide which pointer to advance.
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          workspace_id: true,
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Story 17.16 QA-fix Path D: refuse on terminal-state docs.
      if (
        document.status === WorkspaceDocumentStatus.ARCHIVED ||
        document.status === WorkspaceDocumentStatus.SUPERSEDED
      ) {
        return {
          success: false,
          error:
            'Dokumentet är arkiverat eller upphävt och kan inte återställas. Återaktivera dokumentet först.',
        }
      }

      // Story 17.16 QA-fix Path C: refuse on APPROVED-no-draft. Matches
      // saveDocumentVersion Path C copy so the UX guidance is consistent.
      if (
        document.current_draft_version_id == null &&
        document.status === WorkspaceDocumentStatus.APPROVED
      ) {
        return {
          success: false,
          error:
            'Det godkända dokumentet kan inte ändras direkt. Skapa ett utkast först.',
        }
      }

      // Fetch the old version's content and HTML
      const oldVersion = await prisma.workspaceDocumentVersion.findFirst({
        where: { document_id: documentId, version_number: versionNumber },
        select: { content_json: true, content_html: true },
      })

      if (!oldVersion) {
        return { success: false, error: 'Version hittades inte' }
      }

      // Reuse stored HTML from the old version
      const contentHtml = oldVersion.content_html ?? ''
      const extractedText = extractPlaintext(contentHtml)

      const newVersionNumber = document.current_version_number + 1
      const changeSummary = `Återställning från version ${versionNumber}`

      // Story 17.16 QA-fix: Path A advances ONLY the draft pointer (alias
      // frozen on approved); Path B advances both (never-approved, no approved
      // to protect). Same routing as saveDocumentVersion AC 5.
      const isDraftInProgress = document.current_draft_version_id != null

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: oldVersion.content_json as never,
            content_html: contentHtml,
            extracted_text: extractedText,
            change_summary: changeSummary,
            created_by: userId,
          },
        })

        const docUpdate: Record<string, unknown> = {
          current_version_number: newVersionNumber,
          // Path A + Path B both advance the draft pointer to the restored
          // content. The draft pointer is now the user's "working version"
          // regardless of which path we're on.
          current_draft_version_id: ver.id,
        }
        if (!isDraftInProgress) {
          // Path B (never-approved DRAFT/IN_REVIEW): advance the deprecated
          // alias too. For Path A, the alias is FROZEN on the approved
          // version per Story 17.16 AC 4 + AC 11 — leaving the alias untouched
          // preserves the load-bearing 17.10b auto-reindex compliance contract.
          docUpdate.current_version_id = ver.id
        }

        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: docUpdate,
        })

        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_version_restored',
            new_value: {
              restored_from_version: versionNumber,
              new_version_number: newVersionNumber,
            },
          },
        })

        return ver
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.4: Create Draft from Approved Document
// ============================================================================

/**
 * Story 17.16 (foundation of `epic-17-addendum-dual-version-visibility`):
 *
 * Branches a new editable draft from a status=APPROVED document under Model B
 * (dual-pointer). Behavior changed from Model A (status-flipping) on three
 * load-bearing axes:
 *
 *   1. **`status` stays APPROVED.** The doc-level status describes overall
 *      lifecycle; the draft sub-state is encoded in `current_draft_version_id`
 *      + `draft_status`. Reads asking "is this approved?" continue to return
 *      true throughout the revision window.
 *
 *   2. **`approved_by` / `approved_at` are preserved.** Auditor visits during
 *      a revision window now see the correct approval metadata, not nulls.
 *
 *   3. **`current_version_id` (deprecated alias) is FROZEN on the approved
 *      version.** This is the load-bearing invariant: the 17.10b auto-reindex
 *      reads through the alias, and freezing it on approved content during
 *      the draft window keeps `[Källa:]` citations grounded in approved
 *      content for free — without requiring Story 17.18's full read refactor.
 *      The alias finally advances inside `promoteDraftToApproved` (AC 6) when
 *      the draft is finalized; `discardDraft` (AC 7) leaves it untouched.
 *
 * The editor route is migrated separately in Task 8 (AC 13) to read
 * `current_draft_version.content_json` explicitly when a draft is set, so it
 * loads draft content instead of the alias-pointed approved content.
 *
 * Refuses if a draft is already in progress (`current_draft_version_id IS NOT
 * NULL`) to prevent two concurrent drafts on the same doc.
 */
export async function createDraftFromApproved(
  documentId: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          workspace_id: true,
          current_version: {
            select: { content_json: true, content_html: true },
          },
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      if (document.status !== WorkspaceDocumentStatus.APPROVED) {
        return {
          success: false,
          error: 'Endast godkända dokument kan skapa en ny version',
        }
      }

      // Story 17.16 AC 4: refuse if a draft is already in progress. Prevents
      // two concurrent drafts on the same doc (the new model can only point
      // current_draft_version_id at ONE version at a time).
      if (document.current_draft_version_id != null) {
        return {
          success: false,
          error:
            'Ett utkast pågår redan för det här dokumentet. Slutför eller förkasta det innan ni skapar ett nytt.',
        }
      }

      const contentJson =
        document.current_version?.content_json ?? EMPTY_TIPTAP_DOC

      // Reuse stored HTML from the current version
      const contentHtml = document.current_version?.content_html ?? ''
      const extractedText = extractPlaintext(contentHtml)

      const newVersionNumber = document.current_version_number + 1

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: contentJson as never,
            content_html: contentHtml,
            extracted_text: extractedText,
            change_summary: 'Ny version från godkänt dokument',
            created_by: userId,
          },
        })

        // Story 17.16 AC 4: populate ONLY the draft pointer + draft_status +
        // version_number. Do NOT touch current_version_id (alias-freeze
        // invariant). Do NOT touch status. Do NOT NULL approved_by/approved_at
        // — the doc remains operationally APPROVED throughout the draft window.
        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: {
            current_draft_version_id: ver.id,
            draft_status: 'DRAFT',
            current_version_number: newVersionNumber,
          },
        })

        // Story 17.16 AC 4: ActivityLog 'document_draft_created' (NEW action).
        // The legacy 'document_status_changed' row is NOT written by this path
        // anymore — under Model B, branching does not flip top-level status.
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_draft_created',
            new_value: {
              draft_version_id: ver.id,
              draft_status: 'DRAFT',
              source_approved_version_id: document.current_approved_version_id,
            },
          },
        })

        return ver
      })

      // Story 17.16 AC 4: NO deindex. The doc remains operationally APPROVED
      // throughout the draft window; the 17.10b reindex source (current_version
      // alias) is frozen on the approved version, so the indexed content stays
      // compliance-correct without any reindex churn.

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.11c: Agent Auto-Branch on APPROVED — atomic branch + write
// ============================================================================

/**
 * Story 17.11c AC 1: Atomic branch + write. Called from the agent's
 * `UPDATE_DOCUMENT` / `ADD_DOCUMENT_SECTION` dispatch when `params.creates_draft`
 * is true and the doc is APPROVED-with-no-draft. Mirrors `createDraftFromApproved`'s
 * `$transaction` body but writes the EDITED content directly (not a clone of
 * the approved version) so the user sees ONE new version row (v(N+1) containing
 * the agent's edit), not two (v(N+1) = clone + v(N+2) = edit).
 *
 * Why a sibling action vs Path D in `saveDocumentVersion`: Path C's refusal of
 * APPROVED-no-draft is load-bearing for the editor autosave path. 17.11c is a
 * semantically different operation (intentional branch + write), so it lives
 * in its own server action.
 *
 * Refuses on:
 *  - Document not found in workspace (workspace-scoped via `withWorkspace`).
 *  - `status !== 'APPROVED'` (writeable predicate handled by the dispatch
 *    fork — this guard is defense-in-depth).
 *  - `current_draft_version_id != null` (draft already in progress — caller
 *    should fall through to plain `saveDocumentVersion` against that draft).
 *
 * Writes TWO ActivityLog rows in the same transaction:
 *  - `document_draft_created` — mirrors `createDraftFromApproved`'s shape;
 *    enriched downstream by dispatch (AC 14) with
 *    `{ by:'agent', pendingActionId, operation: 'auto_branch_then_<...>' }`.
 *  - `document_version_saved` — mirrors `saveDocumentVersion`'s shape;
 *    enriched downstream by dispatch (AC 8) with the standard
 *    `{ by:'agent', pendingActionId, operation: 'update_section' | 'add_section' }`.
 *
 * Triggers `indexWorkspaceDocument` via `after()` post-commit so the new draft
 * tier chunks land asynchronously (17.18 indexer handles the dual-tier write).
 */
export async function createDraftFromApprovedWithEdit(
  documentId: string,
  editedContentJson: object,
  changeSummary: string,
  contentHtml?: string
): Promise<ActionResult<{ id: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: {
          id: true,
          status: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          workspace_id: true,
        },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      if (document.status !== WorkspaceDocumentStatus.APPROVED) {
        return {
          success: false,
          error:
            'Endast godkända dokument kan förgrenas via agentens auto-branch.',
        }
      }

      // Mirrors createDraftFromApproved's AC 4 refusal copy verbatim so audit
      // consumers see the same error string regardless of which path tried.
      if (document.current_draft_version_id != null) {
        return {
          success: false,
          error:
            'Ett utkast pågår redan för det här dokumentet. Slutför eller förkasta det innan ni skapar ett nytt.',
        }
      }

      const html = contentHtml ?? ''
      const extractedText = extractPlaintext(html)
      const newVersionNumber = document.current_version_number + 1

      const version = await prisma.$transaction(async (tx) => {
        const ver = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: document.id,
            version_number: newVersionNumber,
            source: 'TIPTAP',
            content_json: editedContentJson as never,
            content_html: html,
            extracted_text: extractedText,
            change_summary: changeSummary,
            created_by: userId,
          },
        })

        // Alias-freeze invariant: only the draft pointer + draft_status advance.
        // current_version_id (alias) stays on the approved version so 17.10b
        // auto-reindex keeps grounding [Källa:] in approved content during the
        // draft window — same semantics as createDraftFromApproved + Path A.
        await tx.workspaceDocument.update({
          where: { id: document.id },
          data: {
            current_draft_version_id: ver.id,
            draft_status: 'DRAFT',
            current_version_number: newVersionNumber,
          },
        })

        // Twin ActivityLog rows: dispatch (AC 8 + AC 14) patches BOTH rows with
        // agent-author + operation discriminator. The pairing lets audit
        // consumers see the branch + write as a single semantic event.
        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_draft_created',
            new_value: {
              draft_version_id: ver.id,
              draft_status: 'DRAFT',
              source_approved_version_id: document.current_approved_version_id,
            },
          },
        })

        await tx.activityLog.create({
          data: {
            workspace_id: document.workspace_id,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: document.id,
            action: 'document_version_saved',
            new_value: {
              version_number: newVersionNumber,
              change_summary: changeSummary,
            },
          },
        })

        return ver
      })

      // 17.18 indexer keys off draft pointer presence — picks up the new tier
      // on the next reindex pass. Same after()/hash-gating pattern as
      // saveDocumentVersion (line 832).
      after(async () => {
        try {
          await indexWorkspaceDocument(document.id, document.workspace_id)
        } catch (err) {
          console.error(
            `[createDraftFromApprovedWithEdit] reindex failed for ${document.id} — retryable:`,
            err instanceof Error ? err.message : err
          )
        }
      })

      return {
        success: true,
        data: { id: version.id, versionNumber: newVersionNumber },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.16: Promote Draft to Approved + Discard Draft (Dual-Version Model)
// ============================================================================

/**
 * Story 17.16 AC 6: Atomic transition that promotes the in-progress draft
 * version to the new approved baseline. The single moment the deprecated
 * `current_version_id` alias finally advances — it was frozen on the prior
 * approved version throughout the draft window per `createDraftFromApproved`
 * (AC 4) + `saveDocumentVersion` Path A (AC 5).
 *
 * Versus `updateDocumentStatus({newStatus: 'APPROVED'})`: this function is for
 * the **dual-state** case (a doc that has BOTH a prior approved version AND a
 * draft currently in progress). `updateDocumentStatus` continues to handle
 * **never-approved** drafts (no prior approved version exists; the simple
 * IN_REVIEW → APPROVED transition). Tests must cover both paths.
 *
 * Gated on `tasks:edit` — the established convention for agent-driven write
 * paths and editor authoring across Stories 14.22 – 14.30 + 17.11 / 17.11b.
 * A future story may introduce a dedicated `documents:approve` permission
 * (e.g., OWNER + ADMIN only for separation-of-duties); that's out of scope
 * here. Current `lib/auth/permissions.ts` carries `documents:add`,
 * `documents:remove`, `tasks:edit` — `tasks:edit` is the only valid choice.
 */
export async function promoteDraftToApproved(
  documentId: string
): Promise<
  ActionResult<{ newApprovedVersionId: string; versionNumber: number }>
> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }

        const document = await prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: {
            id: true,
            current_approved_version_id: true,
            current_draft_version_id: true,
            draft_status: true,
            workspace_id: true,
          },
        })

        if (!document) {
          return { success: false, error: 'Dokument hittades inte' }
        }

        if (document.current_draft_version_id == null) {
          return {
            success: false,
            error: 'Det finns inget pågående utkast att godkänna.',
          }
        }

        if (document.draft_status !== 'IN_REVIEW') {
          return {
            success: false,
            error:
              'Utkastet måste vara skickat för granskning innan det kan godkännas.',
          }
        }

        const now = new Date()
        const draftVersionId = document.current_draft_version_id
        const priorApprovedVersionId = document.current_approved_version_id

        // Read the draft version's number so we can return it. (Cheap — small
        // FK join; could be eliminated by extending the initial findFirst, but
        // keeps the query lean for the common case where the read is rare.)
        const draftVersion = await prisma.workspaceDocumentVersion.findUnique({
          where: { id: draftVersionId },
          select: { id: true, version_number: true },
        })
        if (!draftVersion) {
          return {
            success: false,
            error: 'Utkastversionen hittades inte.',
          }
        }

        await prisma.$transaction(async (tx) => {
          // Stamp the OLD approved version (if any) with superseded_at.
          if (priorApprovedVersionId != null) {
            await tx.workspaceDocumentVersion.update({
              where: { id: priorApprovedVersionId },
              data: { superseded_at: now },
            })
          }

          // Stamp the draft version (now promoted) with approved_at + approved_by.
          await tx.workspaceDocumentVersion.update({
            where: { id: draftVersionId },
            data: { approved_at: now, approved_by: userId },
          })

          // Swap pointers + advance the deprecated alias to the just-promoted
          // version (the moment the alias finally catches up). Doc-level
          // approved_by/approved_at are denormalized convenience fields that
          // mirror the just-promoted version's per-version metadata.
          await tx.workspaceDocument.update({
            where: { id: document.id },
            data: {
              current_approved_version_id: draftVersionId,
              current_draft_version_id: null,
              draft_status: null,
              current_version_id: draftVersionId, // <-- alias advances HERE
              status: WorkspaceDocumentStatus.APPROVED,
              approved_by: userId,
              approved_at: now,
            },
          })

          await tx.activityLog.create({
            data: {
              workspace_id: document.workspace_id,
              user_id: userId,
              entity_type: 'workspace_document',
              entity_id: document.id,
              action: 'document_draft_promoted',
              new_value: {
                promoted_version_id: draftVersionId,
                prior_approved_version_id: priorApprovedVersionId,
                version_number: draftVersion.version_number,
              },
            },
          })
        })

        // Reindex picks up the new approved content. 17.10b contract continues
        // to apply — Story 17.18 may further refine the indexed-content source.
        after(async () => {
          try {
            await indexWorkspaceDocument(document.id, workspaceId)
          } catch (err) {
            console.error(
              `[promoteDraftToApproved] WORKSPACE_DOCUMENT reindex failed for ${document.id} — retryable:`,
              err instanceof Error ? err.message : err
            )
          }
        })

        return {
          success: true,
          data: {
            newApprovedVersionId: draftVersionId,
            versionNumber: draftVersion.version_number,
          },
        }
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Story 17.16 AC 7: Throw away the in-progress draft cleanly. The approved
 * version stays effective and untouched; the deprecated `current_version_id`
 * alias requires no change (it was already pinned to the approved version
 * throughout the draft window).
 *
 * The discarded draft version row is NOT deleted — version history stays
 * append-only. It just stops being pointed at. A follow-up story may surface
 * "discarded drafts" in the version-history UI; out of scope here.
 *
 * Refuses if no draft is in progress, or if no approved version exists to
 * fall back to (the user should archive the doc instead — `discardDraft`
 * cannot be the path to a contentless doc).
 *
 * Same `tasks:edit` permission posture as `promoteDraftToApproved` (AC 6).
 */
export async function discardDraft(documentId: string): Promise<ActionResult> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }

        const document = await prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: {
            id: true,
            current_approved_version_id: true,
            current_draft_version_id: true,
            draft_status: true,
            workspace_id: true,
            // UAT smoke fix (2026-06-07): roll current_version_number back to
            // the approved version's number so the composite badge renders
            // "Godkänd v{N}" — not "Godkänd v{N+1}" — after discard. The draft
            // creation path bumped current_version_number to N+1; without
            // resetting it, the badge inherits the stale draft number.
            current_approved_version: { select: { version_number: true } },
          },
        })

        if (!document) {
          return { success: false, error: 'Dokument hittades inte' }
        }

        if (document.current_draft_version_id == null) {
          return {
            success: false,
            error: 'Det finns inget pågående utkast att förkasta.',
          }
        }

        if (
          document.current_approved_version_id == null ||
          !document.current_approved_version
        ) {
          return {
            success: false,
            error:
              "Det finns ingen godkänd version att återgå till. Använd 'Arkivera dokument' istället om utkastet inte ska användas.",
          }
        }

        const discardedDraftVersionId = document.current_draft_version_id
        const discardedDraftStatus = document.draft_status
        const approvedVersionNumber =
          document.current_approved_version.version_number

        await prisma.$transaction(async (tx) => {
          // Clear the draft pointers + roll current_version_number back to the
          // approved version's number. The alias is already pinned to the
          // approved version (frozen throughout the draft window per AC 4 +
          // AC 5) — no alias change needed.
          await tx.workspaceDocument.update({
            where: { id: document.id },
            data: {
              current_draft_version_id: null,
              draft_status: null,
              current_version_number: approvedVersionNumber,
            },
          })

          await tx.activityLog.create({
            data: {
              workspace_id: document.workspace_id,
              user_id: userId,
              entity_type: 'workspace_document',
              entity_id: document.id,
              action: 'document_draft_discarded',
              old_value: {
                discarded_version_id: discardedDraftVersionId,
                draft_status: discardedDraftStatus,
              },
            },
          })
        })

        // Defensive reindex (non-load-bearing under Model B — the index
        // already tracks approved content throughout the draft window via the
        // frozen alias). Triggering here guarantees a clean post-condition
        // even if the indexing pipeline was mid-flight on a stale signal.
        after(async () => {
          try {
            await indexWorkspaceDocument(document.id, workspaceId)
          } catch (err) {
            console.error(
              `[discardDraft] WORKSPACE_DOCUMENT reindex failed for ${document.id} — retryable:`,
              err instanceof Error ? err.message : err
            )
          }
        })

        return { success: true }
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Story 17.17 AC 7: Submit an in-progress draft for review.
 *
 * Small wrapper that flips `draft_status: DRAFT → IN_REVIEW` so the editor's
 * Skicka för granskning button has a single explicit server action to call.
 * The doc's top-level `status` is unchanged — under Model B, top-level status
 * only tracks the doc's overall lifecycle (created → first approved → maybe
 * archived), NOT the draft sub-state.
 *
 * Refuses if no draft is in progress, or if the draft is already in review.
 * Same `tasks:edit` permission posture as `promoteDraftToApproved` (AC 6)
 * and `discardDraft` (AC 7).
 *
 * No reindex callback — submitting for review doesn't change content, only
 * the sub-status field; the 17.10b auto-reindex contract still tracks the
 * approved version via the frozen alias.
 */
export async function submitDraftForReview(
  documentId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }

        const document = await prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: {
            id: true,
            current_draft_version_id: true,
            draft_status: true,
            workspace_id: true,
          },
        })

        if (!document) {
          return { success: false, error: 'Dokument hittades inte' }
        }

        if (document.current_draft_version_id == null) {
          return {
            success: false,
            error: 'Det finns inget pågående utkast att skicka för granskning.',
          }
        }

        if (document.draft_status === 'IN_REVIEW') {
          return {
            success: false,
            error: 'Utkastet är redan skickat för granskning.',
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.workspaceDocument.update({
            where: { id: document.id },
            data: { draft_status: 'IN_REVIEW' },
          })

          await tx.activityLog.create({
            data: {
              workspace_id: document.workspace_id,
              user_id: userId,
              entity_type: 'workspace_document',
              entity_id: document.id,
              action: 'document_draft_submitted_for_review',
              new_value: {
                draft_version_id: document.current_draft_version_id,
                draft_status: 'IN_REVIEW',
              },
            },
          })
        })

        return { success: true }
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

/**
 * Story 17.17 smoke addendum: Soft-reject a draft that's in review.
 *
 * Reviewer's "Neka" action — flips `draft_status: IN_REVIEW → DRAFT` so the
 * author can resume editing. Mirrors the legacy Model A "Neka" pattern
 * which used to fire when top-level status was IN_REVIEW; under Model B
 * clean dual-state, top-level status stays APPROVED so the legacy
 * StatusTransitionControls config never reaches the IN_REVIEW branch.
 *
 * The draft pointer is NOT cleared (the draft content stays intact for the
 * author to resume); only the sub-status flips. For a hard-reject (throw
 * the draft away entirely), see {@link discardDraft}.
 *
 * Same `tasks:edit` permission posture as {@link submitDraftForReview}.
 */
export async function rejectDraftReview(
  documentId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(
      async ({ workspaceId, userId, hasPermission }) => {
        if (!hasPermission('tasks:edit')) {
          return {
            success: false,
            error: 'Du har inte behörighet att genomföra den här åtgärden',
          }
        }

        const document = await prisma.workspaceDocument.findFirst({
          where: { id: documentId, workspace_id: workspaceId },
          select: {
            id: true,
            current_draft_version_id: true,
            draft_status: true,
            workspace_id: true,
          },
        })

        if (!document) {
          return { success: false, error: 'Dokument hittades inte' }
        }

        if (document.current_draft_version_id == null) {
          return {
            success: false,
            error: 'Det finns inget pågående utkast att neka.',
          }
        }

        if (document.draft_status !== 'IN_REVIEW') {
          return {
            success: false,
            error:
              'Utkastet är inte skickat för granskning — det finns inget att neka.',
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.workspaceDocument.update({
            where: { id: document.id },
            data: { draft_status: 'DRAFT' },
          })

          await tx.activityLog.create({
            data: {
              workspace_id: document.workspace_id,
              user_id: userId,
              entity_type: 'workspace_document',
              entity_id: document.id,
              action: 'document_draft_review_rejected',
              new_value: {
                draft_version_id: document.current_draft_version_id,
                draft_status: 'DRAFT',
              },
            },
          })
        })

        return { success: true }
      }
    )
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.4: Update Document Metadata
// ============================================================================

export async function updateDocumentMetadata(
  input: UpdateDocumentMetadataInput
): Promise<ActionResult<{ id: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validated = updateDocumentMetadataSchema.parse(input)

      const document = await prisma.workspaceDocument.findFirst({
        where: { id: validated.documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const updateData: Record<string, unknown> = {}
      if (validated.documentNumber !== undefined) {
        updateData.document_number = validated.documentNumber
      }
      if (validated.reviewDate !== undefined) {
        updateData.review_date = validated.reviewDate
          ? new Date(validated.reviewDate)
          : null
      }
      if (validated.retentionUntil !== undefined) {
        updateData.retention_until = validated.retentionUntil
          ? new Date(validated.retentionUntil)
          : null
      }
      if (validated.documentType !== undefined) {
        updateData.document_type = validated.documentType
      }

      await prisma.workspaceDocument.update({
        where: { id: document.id },
        data: updateData,
      })

      return { success: true, data: { id: document.id } }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.7: Get Document Templates
// ============================================================================

export async function getDocumentTemplates(): Promise<ActionResult<unknown>> {
  try {
    return await withWorkspace(async () => {
      const templates = await prisma.workspaceDocumentTemplate.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          document_type: true,
          content_json: true,
          sort_order: true,
        },
      })

      return { success: true, data: templates }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.5: Import .docx Document
// ============================================================================

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_IMPORT_SIZE = 25 * 1024 * 1024 // 25MB

export async function importDocxDocument(
  formData: FormData
): Promise<ActionResult<{ id: string; title: string; versionNumber: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const file = formData.get('file') as File | null
      const title = formData.get('title') as string | null
      const documentType = formData.get('documentType') as string | null
      const documentNumber = formData.get('documentNumber') as string | null

      if (!file || !title) {
        return { success: false, error: 'Fil och titel krävs' }
      }

      // Validate file type
      if (file.type !== DOCX_MIME) {
        return {
          success: false,
          error: 'Ogiltig filtyp — endast .docx stöds',
        }
      }

      // Validate file size
      if (file.size > MAX_IMPORT_SIZE) {
        return { success: false, error: 'Filen är för stor (max 25 MB)' }
      }

      const { importDocxDocumentSchema } = await import(
        '@/lib/validation/documents'
      )
      const validated = importDocxDocumentSchema.parse({
        title,
        documentType: documentType ?? undefined,
        documentNumber: documentNumber ?? undefined,
      })

      // Convert .docx to Tiptap JSON
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      let conversionResult
      try {
        const { convertDocxToTiptap } = await import(
          '@/lib/documents/docx-to-tiptap'
        )
        // Create document ID ahead of time for image upload paths
        const tempDocId = crypto.randomUUID()
        conversionResult = await convertDocxToTiptap(
          buffer,
          workspaceId,
          tempDocId
        )
      } catch {
        return { success: false, error: 'Filen kunde inte konverteras' }
      }

      const { json, html, extractedText } = conversionResult

      // Upload original .docx to Supabase Storage
      const docId = crypto.randomUUID()
      const storagePath = `${workspaceId}/document-imports/${docId}/${file.name}`

      const storageClient = getStorageClient()
      const { error: archiveError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: DOCX_MIME,
          upsert: false,
        })

      // Log archival failure but proceed — document creation is more important
      if (archiveError) {
        console.error('Failed to archive .docx:', archiveError.message)
      }

      // Create document + version v1 in a transaction
      const document = await prisma.$transaction(async (tx) => {
        const doc = await tx.workspaceDocument.create({
          data: {
            id: docId,
            workspace_id: workspaceId,
            title: validated.title,
            document_type: validated.documentType,
            document_number: validated.documentNumber ?? null,
            created_by: userId,
            current_version_number: 1,
          },
        })

        const version = await tx.workspaceDocumentVersion.create({
          data: {
            document_id: doc.id,
            version_number: 1,
            source: 'IMPORT',
            content_json: json as never,
            content_html: html,
            extracted_text: extractedText,
            storage_path: archiveError ? null : storagePath,
            change_summary: 'Importerad från .docx',
            created_by: userId,
          },
        })

        await tx.workspaceDocument.update({
          where: { id: doc.id },
          data: { current_version_id: version.id },
        })

        // ActivityLog
        await tx.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'workspace_document',
            entity_id: doc.id,
            action: 'document_imported',
            new_value: {
              title: validated.title,
              document_type: validated.documentType,
              source_file: file.name,
            },
          },
        })

        return doc
      })

      return {
        success: true,
        data: {
          id: document.id,
          title: document.title,
          versionNumber: 1,
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.12: Document Linking
// ============================================================================

export async function linkDocumentToTask(
  documentId: string,
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, title: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      // Verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { id: true, title: true },
      })
      if (!task) {
        return { success: false, error: 'Uppgift hittades inte' }
      }

      await prisma.workspaceDocumentTaskLink.create({
        data: {
          document_id: documentId,
          task_id: taskId,
          linked_by: userId,
        },
      })

      // ActivityLog
      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_linked_to_task',
          new_value: { task_id: taskId, task_title: task.title },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'Dokumentet är redan länkat till denna uppgift',
        }
      }
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function linkDocumentToListItem(
  documentId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, title: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const listItem = await prisma.lawListItem.findFirst({
        where: { id: listItemId, law_list: { workspace_id: workspaceId } },
        select: { id: true, document: { select: { title: true } } },
      })
      if (!listItem) {
        return { success: false, error: 'Lagkrav hittades inte' }
      }

      await prisma.workspaceDocumentListItemLink.create({
        data: {
          document_id: documentId,
          list_item_id: listItemId,
          linked_by: userId,
        },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_linked_to_list_item',
          new_value: {
            list_item_id: listItemId,
            list_item_title: listItem.document?.title ?? null,
          },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: 'Dokumentet är redan länkat till detta lagkrav',
        }
      }
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function unlinkDocumentFromTask(
  documentId: string,
  taskId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      await prisma.workspaceDocumentTaskLink.deleteMany({
        where: { document_id: documentId, task_id: taskId },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_unlinked_from_task',
          new_value: { task_id: taskId },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function unlinkDocumentFromListItem(
  documentId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, workspace_id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      await prisma.workspaceDocumentListItemLink.deleteMany({
        where: { document_id: documentId, list_item_id: listItemId },
      })

      await prisma.activityLog.create({
        data: {
          workspace_id: document.workspace_id,
          user_id: userId,
          entity_type: 'workspace_document',
          entity_id: documentId,
          action: 'document_unlinked_from_list_item',
          new_value: { list_item_id: listItemId },
        },
      })

      return { success: true }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentLinks(documentId: string): Promise<
  ActionResult<{
    tasks: Array<{ id: string; title: string; linkId: string }>
    listItems: Array<{
      id: string
      title: string
      documentNumber: string | null
      linkId: string
    }>
    requirements: Array<{
      id: string
      linkId: string
      text: string
      listItemTitle: string
      listItemDocumentNumber: string | null
    }>
  }>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })
      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const [taskLinks, listItemLinks, requirementLinks] = await Promise.all([
        prisma.workspaceDocumentTaskLink.findMany({
          where: { document_id: documentId },
          include: {
            task: { select: { id: true, title: true } },
          },
        }),
        prisma.workspaceDocumentListItemLink.findMany({
          where: { document_id: documentId },
          include: {
            list_item: {
              select: {
                id: true,
                document: { select: { title: true, document_number: true } },
              },
            },
          },
        }),
        prisma.requirementEvidenceLink.findMany({
          where: { workspace_document_id: documentId },
          include: {
            requirement: {
              select: {
                id: true,
                text: true,
                list_item: {
                  select: {
                    document: {
                      select: { title: true, document_number: true },
                    },
                  },
                },
              },
            },
          },
        }),
      ])

      return {
        success: true,
        data: {
          tasks: taskLinks.map((l) => ({
            id: l.task.id,
            title: l.task.title,
            linkId: l.id,
          })),
          listItems: listItemLinks.map((l) => ({
            id: l.list_item.id,
            title: l.list_item.document?.title ?? 'Okänd författningstext',
            documentNumber: l.list_item.document?.document_number ?? null,
            linkId: l.id,
          })),
          requirements: requirementLinks.map((l) => ({
            id: l.requirement.id,
            linkId: l.id,
            text: l.requirement.text,
            listItemTitle:
              l.requirement.list_item?.document?.title ?? 'Okänd källa',
            listItemDocumentNumber:
              l.requirement.list_item?.document?.document_number ?? null,
          })),
        },
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentsForTask(taskId: string): Promise<
  ActionResult<
    Array<{
      id: string
      title: string
      documentType: string
      status: string
      versionNumber: number
      linkId: string
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { id: true },
      })
      if (!task) {
        return { success: false, error: 'Uppgift hittades inte' }
      }

      const links = await prisma.workspaceDocumentTaskLink.findMany({
        where: { task_id: taskId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_type: true,
              status: true,
              current_version_number: true,
            },
          },
        },
      })

      return {
        success: true,
        data: links.map((l) => ({
          id: l.document.id,
          title: l.document.title,
          documentType: l.document.document_type,
          status: l.document.status,
          versionNumber: l.document.current_version_number,
          linkId: l.id,
        })),
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

export async function getDocumentsForListItem(listItemId: string): Promise<
  ActionResult<
    Array<{
      id: string
      title: string
      documentType: string
      status: string
      versionNumber: number
      linkId: string
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const listItem = await prisma.lawListItem.findFirst({
        where: { id: listItemId, law_list: { workspace_id: workspaceId } },
        select: { id: true },
      })
      if (!listItem) {
        return { success: false, error: 'Lagkrav hittades inte' }
      }

      const links = await prisma.workspaceDocumentListItemLink.findMany({
        where: { list_item_id: listItemId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_type: true,
              status: true,
              current_version_number: true,
            },
          },
        },
      })

      return {
        success: true,
        data: links.map((l) => ({
          id: l.document.id,
          title: l.document.title,
          documentType: l.document.document_type,
          status: l.document.status,
          versionNumber: l.document.current_version_number,
          linkId: l.id,
        })),
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

// ============================================================================
// Story 17.2: Upload Document Image
// ============================================================================

export async function uploadDocumentImageAction(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const file = formData.get('file') as File | null
      const documentId = formData.get('documentId') as string | null

      if (!file || !documentId) {
        return { success: false, error: 'Fil och dokument-ID krävs' }
      }

      // Verify document belongs to workspace
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true },
      })

      if (!document) {
        return { success: false, error: 'Dokument hittades inte' }
      }

      const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
      ]
      if (!allowedTypes.includes(file.type)) {
        return { success: false, error: 'Ogiltigt filformat' }
      }

      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'Bilden är för stor (max 10MB)' }
      }

      const imageId = crypto.randomUUID()
      const storagePath = `${workspaceId}/document-images/${imageId}/${file.name}`

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const storageClient = getStorageClient()
      const { error: uploadError } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        return { success: false, error: 'Bilduppladdning misslyckades' }
      }

      const {
        data: { publicUrl },
      } = storageClient.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

      return { success: true, data: { url: publicUrl } }
    })
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Ett oväntat fel uppstod' }
  }
}

'use server'

/**
 * Story 24.1: Server-action skeleton for the Epic 24 import pipeline.
 * Story 24.2: createImport + parseImportFile implementations land here.
 * Story 24.3: runMatching implementation (fuzzy + LLM).
 * Story 24.4: review-surface actions (per-row + batch + commit + getImport).
 *
 * Story map:
 *  - createImport          → 24.2 ✓ implemented
 *  - parseImportFile       → 24.2 ✓ implemented
 *  - runMatching           → 24.3 ✓ implemented
 *  - acceptRow             → 24.4 ✓ implemented
 *  - replaceRowMatch       → 24.4 ✓ implemented
 *  - rejectRow             → 24.4 ✓ implemented
 *  - requestCatalogAdd     → 24.4 ✓ implemented
 *  - acceptAllHigh         → 24.4 ✓ NEW
 *  - undoRowDecision       → 24.4 ✓ NEW
 *  - getImport             → 24.4 ✓ NEW
 *  - commitImport          → 24.4 ✓ implemented
 */

import {
  CatalogRequestStatus,
  ImportStatus,
  LawListItemSource,
  RowMatchStatus,
  type Prisma,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { logActivity } from '@/lib/services/activity-logger'
import { sendEmail } from '@/lib/email/email-service'
import ImportReviewReadyEmail from '@/emails/import-review-ready'
import {
  detectColumns,
  parseCsv,
  parseExcel,
  parsePaste,
  type ColumnMapping,
  type ParsedRow,
} from '@/lib/import/parser'
import {
  matchRowsBatch,
  type MatcherInput,
  type MatchResult,
} from '@/lib/import/matcher'
import {
  proposeGroupingsForRows,
  type GroupingProposerRow,
} from '@/lib/import/grouping-proposer'
import {
  createGroupingLlmAdapter,
  GROUPING_LLM_TELEMETRY_NAME,
  type GroupingLlmAdapter,
} from '@/lib/import/grouping-llm'
import { estimateCostUsd } from '@/lib/usage/cost-estimator'
import {
  CommitImportSchema,
  CreateImportSchema,
  ParseImportSchema,
  type CommitImportInput,
  type CreateImportInput,
  type ParseImportInput,
} from '@/lib/validation/law-list-import'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// (Story 24.1 helper `notImplemented<T>()` retired now that all 8 user-facing
// actions and 2 admin actions in this epic have real implementations.)

// ============================================================================
// createImport (Story 24.2)
// ============================================================================

export async function createImport(
  input: CreateImportInput
): Promise<ActionResult<{ importId: string }>> {
  const parsed = CreateImportSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const created = await prisma.lawListImport.create({
        data: {
          workspace_id: ctx.workspaceId,
          created_by_user_id: ctx.userId,
          filename: parsed.data.filename,
          source_type: parsed.data.source_type,
          status: ImportStatus.UPLOADED,
          row_count: 0,
          column_mapping: {},
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        created.id,
        'law_list_import.created',
        null,
        {
          filename: parsed.data.filename,
          source_type: parsed.data.source_type,
        }
      )

      return { success: true, data: { importId: created.id } }
    }, 'tasks:edit')
  } catch (error) {
    console.error('createImport error:', error)
    return { success: false, error: 'Kunde inte skapa importen' }
  }
}

// ============================================================================
// parseImportFile (Story 24.2)
// ============================================================================

const MAX_DECODED_BYTES = 5 * 1024 * 1024 // 5 MB hard cap (AC 9 + AC 20)

export async function parseImportFile(input: ParseImportInput): Promise<
  ActionResult<{
    rowCount: number
    columnMapping: ColumnMapping
    truncated: boolean
  }>
> {
  const parsed = ParseImportSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: {
          id: parsed.data.importId,
          workspace_id: ctx.workspaceId,
        },
        select: { id: true, status: true, source_type: true },
      })
      if (!importRow) {
        return { success: false, error: 'Importen hittades inte' }
      }
      if (importRow.status !== ImportStatus.UPLOADED) {
        return {
          success: false,
          error: 'Importen är inte i UPLOADED-läge — kan inte tolka filen',
        }
      }

      // Decode base64 → Buffer. Reject oversized payloads early.
      let decoded: Buffer
      try {
        decoded = Buffer.from(parsed.data.fileBuffer, 'base64')
      } catch {
        await markImportFailed(
          importRow.id,
          'Vi kunde inte läsa filen. Se till att den är .xlsx, .xls eller .csv och under 5 MB.'
        )
        return {
          success: false,
          error:
            'Vi kunde inte läsa filen. Se till att den är .xlsx, .xls eller .csv och under 5 MB.',
        }
      }
      if (decoded.byteLength > MAX_DECODED_BYTES) {
        await markImportFailed(
          importRow.id,
          'Filen är större än 5 MB. Vi importerar för närvarande max 5 MB.'
        )
        return {
          success: false,
          error:
            'Filen är större än 5 MB. Vi importerar för närvarande max 5 MB.',
        }
      }

      // Dispatch on source_type.
      let parseResult: { rows: ParsedRow[]; truncated: boolean }
      try {
        switch (importRow.source_type) {
          case 'xlsx':
            parseResult = parseExcel(decoded)
            break
          case 'csv':
            parseResult = parseCsv(decoded.toString('utf8'))
            break
          case 'paste':
            parseResult = parsePaste(decoded.toString('utf8'))
            break
          default:
            await markImportFailed(
              importRow.id,
              `Okänd filtyp: ${importRow.source_type}.`
            )
            return {
              success: false,
              error: `Okänd filtyp: ${importRow.source_type}.`,
            }
        }
      } catch (err) {
        console.error('parseImportFile: parser threw', err)
        await markImportFailed(
          importRow.id,
          'Vi kunde inte läsa filen. Se till att den är .xlsx, .xls eller .csv och under 5 MB.'
        )
        return {
          success: false,
          error:
            'Vi kunde inte läsa filen. Se till att den är .xlsx, .xls eller .csv och under 5 MB.',
        }
      }

      if (parseResult.rows.length === 0) {
        await markImportFailed(
          importRow.id,
          'Filen verkar vara tom — vi hittade inga rader att importera.'
        )
        return {
          success: false,
          error: 'Filen verkar vara tom — vi hittade inga rader att importera.',
        }
      }

      const columnMapping = detectColumns(parseResult.rows)

      // Persist rows + update import in a single transaction.
      await prisma.$transaction(async (tx) => {
        await tx.lawListImportRow.createMany({
          data: parseResult.rows.map((row) => ({
            import_id: importRow.id,
            row_index: row.index,
            source_titel:
              columnMapping.titel != null
                ? (row.raw[columnMapping.titel] ?? null)
                : null,
            source_sfs_nummer:
              columnMapping.sfs_nummer != null
                ? (row.raw[columnMapping.sfs_nummer] ?? null)
                : null,
            source_omrade:
              columnMapping.omrade != null
                ? (row.raw[columnMapping.omrade] ?? null)
                : null,
            source_lagansvarig:
              columnMapping.lagansvarig != null
                ? (row.raw[columnMapping.lagansvarig] ?? null)
                : null,
            source_kommentar:
              columnMapping.kommentar != null
                ? (row.raw[columnMapping.kommentar] ?? null)
                : null,
            source_raw: row.raw as Prisma.InputJsonValue,
          })),
        })

        await tx.lawListImport.update({
          where: { id: importRow.id },
          data: {
            row_count: parseResult.rows.length,
            column_mapping: columnMapping as unknown as Prisma.InputJsonValue,
            // Stay UPLOADED — Story 24.3 flips to MATCHING.
            // Surface truncation as a soft warning via error_message
            // (project precedent: warning copy on a successful import).
            error_message: parseResult.truncated
              ? 'Vi importerade de första 1000 raderna. Kontakta oss om du behöver importera fler.'
              : null,
          },
        })
      })

      return {
        success: true,
        data: {
          rowCount: parseResult.rows.length,
          columnMapping,
          truncated: parseResult.truncated,
        },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('parseImportFile error:', error)
    return { success: false, error: 'Kunde inte tolka filen' }
  }
}

async function markImportFailed(importId: string, message: string) {
  try {
    await prisma.lawListImport.update({
      where: { id: importId },
      data: {
        status: ImportStatus.FAILED,
        error_message: message,
      },
    })
  } catch (err) {
    console.error('markImportFailed error:', err)
  }
}

// ============================================================================
// runMatching (Story 24.3)
// ============================================================================

interface RunMatchingResult {
  matchedHighCount: number
  matchedMediumCount: number
  unmatchedCount: number
  durationMs: number
}

export async function runMatching(
  importId: string
): Promise<ActionResult<RunMatchingResult>> {
  if (!importId) {
    return { success: false, error: 'Ogiltigt import-ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: importId, workspace_id: ctx.workspaceId },
        select: { id: true, status: true },
      })
      if (!importRow) {
        return { success: false, error: 'Importen hittades inte' }
      }
      if (importRow.status !== ImportStatus.UPLOADED) {
        // Idempotency: refuse to re-run on a non-UPLOADED import.
        return {
          success: false,
          error: 'Matchningen kan bara köras på en import i UPLOADED-läge',
        }
      }

      const startedAt = Date.now()

      // Flip to MATCHING + log.
      await prisma.lawListImport.update({
        where: { id: importRow.id },
        data: { status: ImportStatus.MATCHING },
      })
      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        importRow.id,
        'law_list_import.matching_started',
        null,
        null
      )

      // Pull pending rows.
      const rows = await prisma.lawListImportRow.findMany({
        where: {
          import_id: importRow.id,
          match_status: RowMatchStatus.PENDING,
        },
        select: {
          id: true,
          source_titel: true,
          source_sfs_nummer: true,
          source_omrade: true,
          source_kommentar: true,
        },
      })

      if (rows.length === 0) {
        // Defensive: no pending rows. Flip back to UPLOADED so it's re-runnable.
        await prisma.lawListImport.update({
          where: { id: importRow.id },
          data: { status: ImportStatus.UPLOADED },
        })
        return {
          success: false,
          error: 'Inga rader att matcha',
        }
      }

      const inputs: MatcherInput[] = rows.map((r) => ({
        titel: r.source_titel,
        sfs_nummer: r.source_sfs_nummer,
        omrade: r.source_omrade,
        kommentar: r.source_kommentar,
      }))

      let results: MatchResult[]
      try {
        results = await matchRowsBatch(inputs, {
          telemetry: {
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
          },
        })
      } catch (err) {
        console.error('runMatching: matchRowsBatch threw', err)
        // Flip back to UPLOADED so user can retry once API is healthy.
        await prisma.lawListImport.update({
          where: { id: importRow.id },
          data: { status: ImportStatus.UPLOADED },
        })
        return {
          success: false,
          error: 'Matchningstjänsten är inte tillgänglig — försök igen senare',
        }
      }

      // Persist results per row.
      let matchedHighCount = 0
      let matchedMediumCount = 0
      let unmatchedCount = 0

      const persistOps = rows.map((row, idx) => {
        const result = results[idx]!
        const matchStatus: RowMatchStatus =
          result.confidence_tier === 'high'
            ? RowMatchStatus.MATCHED_HIGH
            : result.confidence_tier === 'medium'
              ? RowMatchStatus.MATCHED_MEDIUM
              : RowMatchStatus.UNMATCHED
        if (matchStatus === RowMatchStatus.MATCHED_HIGH) matchedHighCount++
        else if (matchStatus === RowMatchStatus.MATCHED_MEDIUM)
          matchedMediumCount++
        else unmatchedCount++

        return prisma.lawListImportRow.update({
          where: { id: row.id },
          data: {
            matched_document_id: result.matched_document_id,
            confidence_score: result.confidence_score,
            match_status: matchStatus,
            // Store top-5 candidates as JSON for the review UI.
            match_candidates: result.candidates.map((c) => ({
              document_id: c.document_id,
              title: c.title,
              document_number: c.document_number,
              content_type: c.content_type,
              fuzzy_score: c.fuzzy_score,
            })) as unknown as Prisma.InputJsonValue,
            match_reasoning: result.reasoning,
          },
        })
      })

      // Defensive failure-rate gate (AC 12): if >50% of rows hit hard
      // unmatched-with-no-candidates path, mark the whole import FAILED.
      const totalFailedHard = results.filter(
        (r) => r.confidence_tier === 'unmatched' && r.candidates.length === 0
      ).length
      const failureRate = totalFailedHard / results.length
      if (failureRate > 0.5) {
        // Persist the row updates we already computed (so the user sees
        // partial progress in the import history), then flip import to FAILED.
        await prisma.$transaction(persistOps)
        await prisma.lawListImport.update({
          where: { id: importRow.id },
          data: {
            status: ImportStatus.FAILED,
            error_message: 'Matchningen misslyckades — kontakta support',
          },
        })
        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'law_list_import',
          importRow.id,
          'law_list_import.matching_failed',
          null,
          { totalRows: results.length, hardFailedRows: totalFailedHard }
        )
        return {
          success: false,
          error: 'Matchningen misslyckades — kontakta support',
        }
      }

      // Happy path: persist row updates + flip to AWAITING_REVIEW + log.
      await prisma.$transaction(persistOps)
      await prisma.lawListImport.update({
        where: { id: importRow.id },
        data: { status: ImportStatus.AWAITING_REVIEW },
      })

      const durationMs = Date.now() - startedAt
      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        importRow.id,
        'law_list_import.matching_completed',
        null,
        {
          matched_high_count: matchedHighCount,
          matched_medium_count: matchedMediumCount,
          unmatched_count: unmatchedCount,
          total: results.length,
          duration_ms: durationMs,
        }
      )

      return {
        success: true,
        data: {
          matchedHighCount,
          matchedMediumCount,
          unmatchedCount,
          durationMs,
        },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('runMatching error:', error)
    return { success: false, error: 'Kunde inte köra matchningen' }
  }
}

// ============================================================================
// Helper: load row with workspace scoping
// ============================================================================

async function loadWorkspaceScopedRow(rowId: string, workspaceId: string) {
  return prisma.lawListImportRow.findFirst({
    where: {
      id: rowId,
      import: { workspace_id: workspaceId },
    },
    include: { import: { select: { id: true, status: true } } },
  })
}

// Pre-decision states the row must be in for the user to act on it.
const PRE_DECISION_STATES: RowMatchStatus[] = [
  RowMatchStatus.PENDING,
  RowMatchStatus.MATCHED_HIGH,
  RowMatchStatus.MATCHED_MEDIUM,
  RowMatchStatus.UNMATCHED,
]

// ============================================================================
// acceptRow (Story 24.4)
// ============================================================================

export async function acceptRow(rowId: string): Promise<ActionResult> {
  if (!rowId) return { success: false, error: 'Ogiltigt rad-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const row = await loadWorkspaceScopedRow(rowId, ctx.workspaceId)
      if (!row) return { success: false, error: 'Raden hittades inte' }

      // Idempotency: re-accepting an already-accepted row is a no-op success.
      if (row.match_status === RowMatchStatus.ACCEPTED_BY_USER) {
        return { success: true }
      }

      const matchedStates: RowMatchStatus[] = [
        RowMatchStatus.MATCHED_HIGH,
        RowMatchStatus.MATCHED_MEDIUM,
      ]
      if (!matchedStates.includes(row.match_status)) {
        return {
          success: false,
          error: 'Raden kan inte accepteras i sitt nuvarande tillstånd',
        }
      }
      if (!row.matched_document_id) {
        return {
          success: false,
          error: 'Raden saknar matchat dokument',
        }
      }

      await prisma.lawListImportRow.update({
        where: { id: rowId },
        data: {
          match_status: RowMatchStatus.ACCEPTED_BY_USER,
          user_decided_at: new Date(),
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        row.import.id,
        'law_list_import.row_accepted',
        null,
        { row_id: rowId, document_id: row.matched_document_id }
      )

      revalidatePath(`/laglistor/skapa/${row.import.id}/granska`)
      return { success: true }
    }, 'tasks:edit')
  } catch (err) {
    console.error('acceptRow error:', err)
    return { success: false, error: 'Kunde inte acceptera raden' }
  }
}

// ============================================================================
// replaceRowMatch (Story 24.4)
// ============================================================================

interface MatchCandidateJson {
  document_id: string
  title: string
  document_number: string | null
  content_type: string
  fuzzy_score: number
}

function isMatchCandidate(v: unknown): v is MatchCandidateJson {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { document_id?: unknown }).document_id === 'string'
  )
}

export async function replaceRowMatch(
  rowId: string,
  candidateDocId: string
): Promise<ActionResult> {
  if (!rowId || !candidateDocId) {
    return { success: false, error: 'Ogiltigt rad-ID eller dokument-ID' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const row = await loadWorkspaceScopedRow(rowId, ctx.workspaceId)
      if (!row) return { success: false, error: 'Raden hittades inte' }

      // Validate candidate is in match_candidates (guard against arbitrary doc-id
      // injection — AC 17 integration test asserts this rejection).
      const candidates = Array.isArray(row.match_candidates)
        ? (row.match_candidates as unknown[]).filter(isMatchCandidate)
        : []
      if (!candidates.some((c) => c.document_id === candidateDocId)) {
        return {
          success: false,
          error: 'Det valda dokumentet finns inte bland matchningskandidaterna',
        }
      }

      await prisma.lawListImportRow.update({
        where: { id: rowId },
        data: {
          matched_document_id: candidateDocId,
          match_status: RowMatchStatus.REPLACED_BY_USER,
          user_decided_at: new Date(),
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        row.import.id,
        'law_list_import.row_replaced',
        { document_id: row.matched_document_id },
        { row_id: rowId, document_id: candidateDocId }
      )

      revalidatePath(`/laglistor/skapa/${row.import.id}/granska`)
      return { success: true }
    }, 'tasks:edit')
  } catch (err) {
    console.error('replaceRowMatch error:', err)
    return { success: false, error: 'Kunde inte byta matchning' }
  }
}

// ============================================================================
// rejectRow (Story 24.4)
// ============================================================================

export async function rejectRow(rowId: string): Promise<ActionResult> {
  if (!rowId) return { success: false, error: 'Ogiltigt rad-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const row = await loadWorkspaceScopedRow(rowId, ctx.workspaceId)
      if (!row) return { success: false, error: 'Raden hittades inte' }

      // Idempotency
      if (row.match_status === RowMatchStatus.REJECTED_BY_USER) {
        return { success: true }
      }

      if (!PRE_DECISION_STATES.includes(row.match_status)) {
        return {
          success: false,
          error: 'Raden kan inte avvisas i sitt nuvarande tillstånd',
        }
      }

      await prisma.lawListImportRow.update({
        where: { id: rowId },
        data: {
          match_status: RowMatchStatus.REJECTED_BY_USER,
          user_decided_at: new Date(),
        },
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        row.import.id,
        'law_list_import.row_rejected',
        null,
        { row_id: rowId }
      )

      revalidatePath(`/laglistor/skapa/${row.import.id}/granska`)
      return { success: true }
    }, 'tasks:edit')
  } catch (err) {
    console.error('rejectRow error:', err)
    return { success: false, error: 'Kunde inte avvisa raden' }
  }
}

// ============================================================================
// requestCatalogAdd (Story 24.4)
// ============================================================================

export async function requestCatalogAdd(
  rowId: string,
  note?: string
): Promise<ActionResult<{ requestId: string }>> {
  if (!rowId) return { success: false, error: 'Ogiltigt rad-ID' }
  if (note !== undefined && note.length > 1000) {
    return { success: false, error: 'Noteringen får vara max 1000 tecken' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const row = await loadWorkspaceScopedRow(rowId, ctx.workspaceId)
      if (!row) return { success: false, error: 'Raden hittades inte' }

      // Schema's CatalogIngestRequest.import_row_id is @unique so we can
      // safely upsert: existing request → return its id; new → create.
      // This makes the action idempotent at the natural-key level.
      const existing = await prisma.catalogIngestRequest.findUnique({
        where: { import_row_id: rowId },
      })
      if (existing) {
        return { success: true, data: { requestId: existing.id } }
      }

      if (row.match_status !== RowMatchStatus.UNMATCHED) {
        return {
          success: false,
          error:
            'Katalogtillägg kan bara begäras för rader som inte matchat något dokument',
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        const request = await tx.catalogIngestRequest.create({
          data: {
            workspace_id: ctx.workspaceId,
            import_row_id: rowId,
            requested_by_user_id: ctx.userId,
            admin_note: note ?? null,
          },
        })
        await tx.lawListImportRow.update({
          where: { id: rowId },
          data: {
            match_status: RowMatchStatus.CATALOG_REQUEST_PENDING,
            user_decided_at: new Date(),
          },
        })
        return request
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        row.import.id,
        'law_list_import.row_catalog_requested',
        null,
        { row_id: rowId, request_id: created.id, has_note: note != null }
      )

      revalidatePath(`/laglistor/skapa/${row.import.id}/granska`)
      return { success: true, data: { requestId: created.id } }
    }, 'tasks:edit')
  } catch (err) {
    console.error('requestCatalogAdd error:', err)
    return { success: false, error: 'Kunde inte begära katalogtillägg' }
  }
}

// ============================================================================
// acceptAllHigh (Story 24.4)
// ============================================================================

export async function acceptAllHigh(
  importId: string
): Promise<ActionResult<{ count: number }>> {
  if (!importId) return { success: false, error: 'Ogiltigt import-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: importId, workspace_id: ctx.workspaceId },
        select: { id: true, status: true },
      })
      if (!importRow) return { success: false, error: 'Importen hittades inte' }
      if (importRow.status !== ImportStatus.AWAITING_REVIEW) {
        return {
          success: false,
          error:
            'Bulk-acceptera kan bara göras när importen väntar på granskning',
        }
      }

      const result = await prisma.lawListImportRow.updateMany({
        where: {
          import_id: importId,
          match_status: RowMatchStatus.MATCHED_HIGH,
          matched_document_id: { not: null },
        },
        data: {
          match_status: RowMatchStatus.ACCEPTED_BY_USER,
          user_decided_at: new Date(),
        },
      })

      if (result.count > 0) {
        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'law_list_import',
          importId,
          'law_list_import.bulk_accepted_high',
          null,
          { count: result.count }
        )
      }

      revalidatePath(`/laglistor/skapa/${importId}/granska`)
      return { success: true, data: { count: result.count } }
    }, 'tasks:edit')
  } catch (err) {
    console.error('acceptAllHigh error:', err)
    return { success: false, error: 'Kunde inte acceptera höga matchningar' }
  }
}

// ============================================================================
// undoRowDecision (Story 24.4)
// ============================================================================

function tierFromConfidence(score: number | null): RowMatchStatus {
  if (score == null) return RowMatchStatus.PENDING
  if (score >= 0.85) return RowMatchStatus.MATCHED_HIGH
  if (score >= 0.5) return RowMatchStatus.MATCHED_MEDIUM
  return RowMatchStatus.UNMATCHED
}

export async function undoRowDecision(rowId: string): Promise<ActionResult> {
  if (!rowId) return { success: false, error: 'Ogiltigt rad-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const row = await loadWorkspaceScopedRow(rowId, ctx.workspaceId)
      if (!row) return { success: false, error: 'Raden hittades inte' }

      const decisionStates: RowMatchStatus[] = [
        RowMatchStatus.ACCEPTED_BY_USER,
        RowMatchStatus.REPLACED_BY_USER,
        RowMatchStatus.REJECTED_BY_USER,
        RowMatchStatus.CATALOG_REQUEST_PENDING,
      ]
      if (!decisionStates.includes(row.match_status)) {
        return {
          success: false,
          error: 'Inget beslut att ångra på den här raden',
        }
      }

      // Compute the prior tier from confidence_score. For rejected rows that
      // had matched documents, restore to the matched tier; for catalog-
      // requested rows (always UNMATCHED before the request), restore to
      // UNMATCHED. For replaced rows, the prior state was MATCHED_HIGH or
      // MATCHED_MEDIUM — derive from confidence_score.
      const priorTier = tierFromConfidence(row.confidence_score)

      await prisma.$transaction(async (tx) => {
        // If the row had a CatalogIngestRequest, delete it so the user can
        // re-request later (cleaner audit trail than orphaning the request).
        if (row.match_status === RowMatchStatus.CATALOG_REQUEST_PENDING) {
          await tx.catalogIngestRequest.deleteMany({
            where: {
              import_row_id: rowId,
              status: CatalogRequestStatus.PENDING,
            },
          })
        }

        await tx.lawListImportRow.update({
          where: { id: rowId },
          data: {
            match_status: priorTier,
            user_decided_at: null,
          },
        })
      })

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        row.import.id,
        'law_list_import.row_decision_undone',
        { match_status: row.match_status },
        { row_id: rowId, restored_to: priorTier }
      )

      revalidatePath(`/laglistor/skapa/${row.import.id}/granska`)
      return { success: true }
    }, 'tasks:edit')
  } catch (err) {
    console.error('undoRowDecision error:', err)
    return { success: false, error: 'Kunde inte ångra beslutet' }
  }
}

// ============================================================================
// getImport (Story 24.4) — hydrates page.tsx + drives SWR polling
// ============================================================================

export interface ImportRowSummary {
  id: string
  row_index: number
  source_titel: string | null
  source_sfs_nummer: string | null
  source_omrade: string | null
  source_lagansvarig: string | null
  source_kommentar: string | null
  match_status: RowMatchStatus
  matched_document_id: string | null
  matched_document: {
    id: string
    title: string
    document_number: string
    content_type: string
    slug: string
  } | null
  confidence_score: number | null
  match_candidates: MatchCandidateJson[]
  match_reasoning: string | null
}

export interface ImportSummary {
  id: string
  filename: string
  source_type: string
  status: ImportStatus
  row_count: number
  committed_law_list_id: string | null
  error_message: string | null
  created_at: Date
  committed_at: Date | null
  rows: ImportRowSummary[]
  counts: {
    total: number
    matched_high: number
    matched_medium: number
    unmatched: number
    accepted: number
    replaced: number
    rejected: number
    catalog_requested: number
    catalog_fulfilled: number
  }
}

export async function getImport(
  importId: string
): Promise<ActionResult<ImportSummary>> {
  if (!importId) return { success: false, error: 'Ogiltigt import-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: importId, workspace_id: ctx.workspaceId },
        include: {
          rows: {
            orderBy: { row_index: 'asc' },
            include: {
              matched_document: {
                select: {
                  id: true,
                  title: true,
                  document_number: true,
                  content_type: true,
                  slug: true,
                },
              },
            },
          },
        },
      })
      if (!importRow) return { success: false, error: 'Importen hittades inte' }

      const counts = {
        total: importRow.rows.length,
        matched_high: 0,
        matched_medium: 0,
        unmatched: 0,
        accepted: 0,
        replaced: 0,
        rejected: 0,
        catalog_requested: 0,
        catalog_fulfilled: 0,
      }
      for (const r of importRow.rows) {
        switch (r.match_status) {
          case RowMatchStatus.MATCHED_HIGH:
            counts.matched_high++
            break
          case RowMatchStatus.MATCHED_MEDIUM:
            counts.matched_medium++
            break
          case RowMatchStatus.UNMATCHED:
            counts.unmatched++
            break
          case RowMatchStatus.ACCEPTED_BY_USER:
            counts.accepted++
            break
          case RowMatchStatus.REPLACED_BY_USER:
            counts.replaced++
            break
          case RowMatchStatus.REJECTED_BY_USER:
            counts.rejected++
            break
          case RowMatchStatus.CATALOG_REQUEST_PENDING:
            counts.catalog_requested++
            break
          case RowMatchStatus.CATALOG_REQUEST_FULFILLED:
            counts.catalog_fulfilled++
            break
        }
      }

      const rows: ImportRowSummary[] = importRow.rows.map((r) => ({
        id: r.id,
        row_index: r.row_index,
        source_titel: r.source_titel,
        source_sfs_nummer: r.source_sfs_nummer,
        source_omrade: r.source_omrade,
        source_lagansvarig: r.source_lagansvarig,
        source_kommentar: r.source_kommentar,
        match_status: r.match_status,
        matched_document_id: r.matched_document_id,
        matched_document: r.matched_document
          ? {
              id: r.matched_document.id,
              title: r.matched_document.title,
              document_number: r.matched_document.document_number,
              content_type: r.matched_document.content_type,
              slug: r.matched_document.slug,
            }
          : null,
        confidence_score: r.confidence_score,
        match_candidates: Array.isArray(r.match_candidates)
          ? (r.match_candidates as unknown[]).filter(isMatchCandidate)
          : [],
        match_reasoning: r.match_reasoning,
      }))

      return {
        success: true,
        data: {
          id: importRow.id,
          filename: importRow.filename,
          source_type: importRow.source_type,
          status: importRow.status,
          row_count: importRow.row_count,
          committed_law_list_id: importRow.committed_law_list_id,
          error_message: importRow.error_message,
          created_at: importRow.created_at,
          committed_at: importRow.committed_at,
          rows,
          counts,
        },
      }
    }, 'read')
  } catch (err) {
    console.error('getImport error:', err)
    return { success: false, error: 'Kunde inte hämta importen' }
  }
}

// ============================================================================
// listPendingImports (Epic 24 follow-up — resume banner)
// ============================================================================

/**
 * Returns in-flight imports for the current workspace so the `/laglistor`
 * banner can offer a "Återuppta granskning" affordance. Read-only: scoped
 * by `withWorkspace(cb, 'read')`.
 *
 * Filter: AWAITING_REVIEW + MATCHING — both states represent unfinished
 * user work. UPLOADED is transient (matcher running), COMMITTED is done,
 * FAILED is a separate UX. The `@@index([workspace_id, status])` on
 * LawListImport keeps this cheap.
 */
export interface PendingImportSummary {
  id: string
  filename: string
  status: ImportStatus
  row_count: number
  created_at: Date
}

export async function listPendingImports(): Promise<
  ActionResult<PendingImportSummary[]>
> {
  try {
    return await withWorkspace(async (ctx) => {
      const rows = await prisma.lawListImport.findMany({
        where: {
          workspace_id: ctx.workspaceId,
          status: {
            in: [ImportStatus.AWAITING_REVIEW, ImportStatus.MATCHING],
          },
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          filename: true,
          status: true,
          row_count: true,
          created_at: true,
        },
      })
      return { success: true, data: rows }
    }, 'read')
  } catch (err) {
    console.error('listPendingImports error:', err)
    return { success: false, error: 'Kunde inte hämta pågående importer' }
  }
}

// ============================================================================
// discardImport (Epic 24 follow-up — banner cancel action)
// ============================================================================

/**
 * Hard-delete a workspace's in-flight import. Cascades to LawListImportRow
 * and any linked CatalogIngestRequests via Prisma onDelete: Cascade.
 *
 * Status guard: only AWAITING_REVIEW + MATCHING are discardable. COMMITTED
 * imports have already produced a LawList (delete that separately if you
 * want it gone); FAILED imports retain their error_message for debugging
 * and don't show in the resume banner anyway.
 */
export async function discardImport(
  importId: string
): Promise<ActionResult<{ filename: string }>> {
  if (!importId) return { success: false, error: 'Ogiltigt import-ID' }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: importId, workspace_id: ctx.workspaceId },
        select: {
          id: true,
          filename: true,
          status: true,
          row_count: true,
        },
      })
      if (!importRow) return { success: false, error: 'Importen hittades inte' }

      if (
        importRow.status !== ImportStatus.AWAITING_REVIEW &&
        importRow.status !== ImportStatus.MATCHING
      ) {
        return {
          success: false,
          error: 'Endast pågående importer kan avbrytas',
        }
      }

      await prisma.lawListImport.delete({ where: { id: importRow.id } })

      // Activity log — capture filename + row_count snapshot since the row
      // is now gone and the entity-resolver can't hydrate the label.
      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        importRow.id,
        'law_list_import.discarded',
        {
          filename: importRow.filename,
          row_count: importRow.row_count,
          status: importRow.status,
        },
        null
      )

      revalidatePath('/laglistor')
      return { success: true, data: { filename: importRow.filename } }
    }, 'tasks:edit')
  } catch (err) {
    console.error('discardImport error:', err)
    return { success: false, error: 'Kunde inte avbryta importen' }
  }
}

// ============================================================================
// commitImport (Story 24.4)
// ============================================================================

/**
 * Best-effort `responsible_user_id` resolution per AC 8.bis.
 * Trim + lowercase the source value; match against workspace-member email
 * OR name (case-insensitive). Exactly one match → assign; zero or multiple
 * → null. Source value retained on the import row for audit either way.
 */
async function resolveResponsibleUserId(
  rawSource: string | null,
  workspaceId: string
): Promise<string | null> {
  if (!rawSource) return null
  const source = rawSource.trim()
  if (source.length === 0) return null

  const candidates = await prisma.user.findMany({
    where: {
      workspace_members: { some: { workspace_id: workspaceId } },
      OR: [
        { email: { equals: source, mode: 'insensitive' } },
        { name: { equals: source, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  })
  if (candidates.length === 1) return candidates[0]!.id
  return null
}

export async function commitImport(
  input: CommitImportInput
): Promise<ActionResult<{ lawListId: string }>> {
  const parsed = CommitImportSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: parsed.data.importId, workspace_id: ctx.workspaceId },
        include: {
          rows: {
            where: {
              match_status: {
                in: [
                  RowMatchStatus.ACCEPTED_BY_USER,
                  RowMatchStatus.REPLACED_BY_USER,
                ],
              },
              matched_document_id: { not: null },
            },
          },
        },
      })
      if (!importRow) return { success: false, error: 'Importen hittades inte' }

      // Idempotency (AC 17 integration test): if already committed, return the
      // existing law_list_id rather than creating a duplicate list.
      if (
        importRow.status === ImportStatus.COMMITTED &&
        importRow.committed_law_list_id
      ) {
        return {
          success: true,
          data: { lawListId: importRow.committed_law_list_id },
        }
      }

      if (importRow.status !== ImportStatus.AWAITING_REVIEW) {
        return {
          success: false,
          error: 'Importen kan bara bekräftas när den väntar på granskning',
        }
      }

      // Resolve responsible_user_id per row (best-effort, parallel).
      const rowsWithResponsible = await Promise.all(
        importRow.rows.map(async (r) => ({
          row: r,
          responsibleUserId: await resolveResponsibleUserId(
            r.source_lagansvarig,
            ctx.workspaceId
          ),
        }))
      )

      // Aggregate counts for the activity-log payload + email.
      const allRows = await prisma.lawListImportRow.findMany({
        where: { import_id: importRow.id },
        select: { match_status: true },
      })
      const rejectedCount = allRows.filter(
        (r) => r.match_status === RowMatchStatus.REJECTED_BY_USER
      ).length
      const requestedCount = allRows.filter(
        (r) =>
          r.match_status === RowMatchStatus.CATALOG_REQUEST_PENDING ||
          r.match_status === RowMatchStatus.CATALOG_REQUEST_FULFILLED
      ).length
      const rowsAdded = rowsWithResponsible.length

      // Story 24.7: validate optional groupAssignments BEFORE the transaction.
      // Empty groups[] coalesces to flat (= no LawListGroup rows created).
      const rawGroupAssignments = parsed.data.groupAssignments
      const groupsRequested =
        rawGroupAssignments?.groups.filter((g) => g.rowIds.length >= 0) ?? []
      const useGroups =
        rawGroupAssignments !== undefined && groupsRequested.length > 0

      if (useGroups) {
        const validRowIds = new Set(rowsWithResponsible.map((r) => r.row.id))
        const seenInGroups = new Set<string>()
        const seenGroupNames = new Set<string>()

        for (const group of groupsRequested) {
          const trimmedName = group.name.trim()
          // EMPTY_GROUP_NAME — surface explicit error before the transaction.
          if (trimmedName.length === 0) {
            return {
              success: false,
              error: 'EMPTY_GROUP_NAME',
            }
          }
          // DUPLICATE_GROUP_NAME — same trimmed name appears twice in payload.
          // QA-fix (24.7 review): catching this BEFORE the transaction prevents
          // a partial-state leak where lawList + some lawListGroups would
          // commit before the duplicate triggered a rollback.
          if (seenGroupNames.has(trimmedName)) {
            return {
              success: false,
              error: `DUPLICATE_GROUP_NAME:${trimmedName}`,
            }
          }
          seenGroupNames.add(trimmedName)
          for (const rowId of group.rowIds) {
            // INVALID_ROW_REFERENCE — every rowId must belong to a committable
            // row of THIS import (state ∈ {ACCEPTED, REPLACED} and matched).
            if (!validRowIds.has(rowId)) {
              return {
                success: false,
                error: 'INVALID_ROW_REFERENCE',
              }
            }
            // DUPLICATE_ROW_ASSIGNMENT — same rowId in two groups.
            if (seenInGroups.has(rowId)) {
              return {
                success: false,
                error: `DUPLICATE_ROW_ASSIGNMENT:${rowId}`,
              }
            }
            seenInGroups.add(rowId)
          }
        }
      }

      // Story 24.7: build a rowId → groupName lookup for the transaction.
      // Built outside the transaction so we don't repeat work; rows not in
      // any group commit with group_id = null (= ungrouped).
      const rowIdToGroupName = new Map<string, string>()
      if (useGroups) {
        for (const group of groupsRequested) {
          const trimmedName = group.name.trim()
          for (const rowId of group.rowIds) {
            rowIdToGroupName.set(rowId, trimmedName)
          }
        }
      }

      // Single transaction: create LawList → LawListGroups → LawListItems → flip import status.
      // QA-fix (24.7 review): validation errors must throw (not return
      // sentinels) so Prisma rolls back the entire transaction. Returning
      // a non-error value commits, which would leak orphaned lawList rows.
      let groupsCreated = 0
      const TX_DUPLICATE_GROUP_NAME = '__TX_DUPLICATE_GROUP_NAME__'
      let txDuplicateConflict = ''
      const lawList = await prisma
        .$transaction(async (tx) => {
          const created = await tx.lawList.create({
            data: {
              workspace_id: ctx.workspaceId,
              name: parsed.data.listName,
              created_by: ctx.userId,
            },
          })

          // Story 24.7: create LawListGroup rows in input order. Position is
          // the array index so the new list opens with groups in the order
          // the user saw in the panel. Duplicate-within-payload is already
          // caught pre-transaction; the P2002 catch below defends against
          // a TOCTOU race between two simultaneous commits.
          const groupNameToId = new Map<string, string>()
          if (useGroups) {
            for (let i = 0; i < groupsRequested.length; i++) {
              const group = groupsRequested[i]!
              const trimmedName = group.name.trim()
              // Skip empty groups (no rows assigned) — common when a user
              // added a fresh group via "Lägg till grupp" but moved no rows
              // into it.
              if (group.rowIds.length === 0) continue
              try {
                const groupRow = await tx.lawListGroup.create({
                  data: {
                    law_list_id: created.id,
                    name: trimmedName,
                    position: i,
                  },
                })
                groupNameToId.set(trimmedName, groupRow.id)
                groupsCreated += 1
              } catch (err) {
                // Prisma P2002 — unique constraint @@unique([law_list_id, name]).
                if (
                  err instanceof Error &&
                  'code' in err &&
                  (err as { code: string }).code === 'P2002'
                ) {
                  txDuplicateConflict = trimmedName
                  throw new Error(TX_DUPLICATE_GROUP_NAME)
                }
                throw err
              }
            }
          }

          // Create one LawListItem per accepted/replaced row. Carry over
          // source_omrade → category, source_kommentar → notes, lagansvarig →
          // responsible_user_id (best-effort). Skip duplicates of (law_list_id,
          // document_id) — Prisma's @@unique([law_list_id, document_id]) on
          // LawListItem would otherwise throw.
          // Treat the moment of import as the "I have read this document up to
          // here" baseline. Without this, the pending-change-count query at
          // `app/actions/document-list.ts` (Story 8.1) would surface every
          // historical amendment for the underlying LegalDocument as new — a
          // bulk-import would light up the Ändringar tab with months of stale
          // events that the user had no opportunity to acknowledge.
          const importedAt = new Date()
          const seenDocs = new Set<string>()
          const itemsToCreate: Prisma.LawListItemCreateManyInput[] = []
          for (const { row, responsibleUserId } of rowsWithResponsible) {
            const docId = row.matched_document_id!
            if (seenDocs.has(docId)) continue
            seenDocs.add(docId)
            // Story 24.7: assign group_id from the rowId → groupName → groupId
            // chain. Fall back to null when the row isn't in any group.
            const groupName = rowIdToGroupName.get(row.id)
            const groupId = groupName
              ? (groupNameToId.get(groupName) ?? null)
              : null
            itemsToCreate.push({
              law_list_id: created.id,
              document_id: docId,
              source: LawListItemSource.IMPORT,
              added_by: ctx.userId,
              // Per AC 8: source_omrade → category (verified: schema has
              // `category` not `area_label`); source_kommentar → notes;
              // source_lagansvarig → responsible_user_id (best-effort).
              category: row.source_omrade ?? null,
              notes: row.source_kommentar ?? null,
              responsible_user_id: responsibleUserId,
              last_change_acknowledged_at: importedAt,
              group_id: groupId,
            })
          }
          if (itemsToCreate.length > 0) {
            await tx.lawListItem.createMany({
              data: itemsToCreate,
              skipDuplicates: true,
            })
          }

          await tx.lawListImport.update({
            where: { id: importRow.id },
            data: {
              status: ImportStatus.COMMITTED,
              committed_law_list_id: created.id,
              committed_at: new Date(),
            },
          })

          return created
        })
        .catch((err: unknown) => {
          // QA-fix: a P2002 inside the transaction now THROWS so Prisma rolls
          // back. We tag the throw with TX_DUPLICATE_GROUP_NAME so we can
          // surface a structured error to the client without leaking other
          // throws.
          if (err instanceof Error && err.message === TX_DUPLICATE_GROUP_NAME) {
            return null
          }
          throw err
        })

      if (lawList === null) {
        return {
          success: false,
          error: `DUPLICATE_GROUP_NAME:${txDuplicateConflict}`,
        }
      }
      const created = lawList

      // Story 24.7: derive grouping_source for telemetry.
      const groupingSource: 'flat' | 'as-suggested' | 'user-edited' = !useGroups
        ? 'flat'
        : rawGroupAssignments?.asSuggested === true
          ? 'as-suggested'
          : 'user-edited'

      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'law_list_import',
        importRow.id,
        'law_list_import.committed',
        null,
        {
          rowsAdded,
          rowsRequested: requestedCount,
          rowsRejected: rejectedCount,
          lawListId: created.id,
          // Story 24.7: optional fields. Always include groupingSource for
          // analytics; groupsCreated only when grouping was used.
          groupingSource,
          ...(useGroups ? { groupsCreated } : {}),
        }
      )

      // Send email — fail-safe (don't fail the commit if email fails).
      try {
        const recipient = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true, name: true },
        })
        if (recipient?.email) {
          const firstName = recipient.name?.split(' ')[0] ?? null
          await sendEmail({
            to: recipient.email,
            subject: 'Din importerade laglista är klar',
            react: ImportReviewReadyEmail({
              firstName,
              listName: parsed.data.listName,
              lawListId: created.id,
              rowsAdded,
              rowsRequested: requestedCount,
            }),
            from: 'notifications',
          })
        }
      } catch (emailErr) {
        console.error('commitImport email send failed (non-fatal):', emailErr)
      }

      revalidatePath('/laglistor')
      revalidatePath(`/laglistor/skapa/${importRow.id}/granska`)
      return { success: true, data: { lawListId: created.id } }
    }, 'tasks:edit')
  } catch (err) {
    console.error('commitImport error:', err)
    return { success: false, error: 'Kunde inte bekräfta importen' }
  }
}

// ============================================================================
// proposeGroupings (Story 24.7)
// ============================================================================

/**
 * Story 24.7 AC 4 — propose groupings for committable rows of an import.
 *
 * Read-only: never mutates DB state. Wraps the pure proposer with auth
 * (`tasks:edit`), the size gate (≥15 committable rows), the feature flag,
 * and ChatUsageEvent + activity-log telemetry.
 *
 * Failure modes return as ActionResult `error` strings the client can
 * branch on:
 *   - `GATE_NOT_MET` — fewer than 15 committable rows
 *   - `IMPORT_NOT_FOUND` — workspace mismatch or missing import
 *   - `WRONG_STATUS` — import not in AWAITING_REVIEW
 *   - `FEATURE_DISABLED` — env flag turned off
 */

const GROUPING_SIZE_GATE = 15

const FEATURE_FLAG_KEY = 'LAWLIST_IMPORT_GROUPINGS_ENABLED'

function isGroupingsFeatureEnabled(): boolean {
  // Read once per call (Next.js server actions don't cache module state
  // strongly between hot reloads in dev). The env var being present + not
  // explicitly "false" means enabled — defaults to true per AC 20.
  const raw = process.env[FEATURE_FLAG_KEY]
  if (raw === undefined || raw === '') return true
  return raw.toLowerCase() !== 'false' && raw !== '0'
}

export interface ProposeGroupingsResult {
  groups: Array<{ name: string; rowIds: string[]; source: 'omrade' | 'llm' }>
  unassigned: string[]
  generatedAt: string
  llmUsed: boolean
  llmFailureReason?: string
}

export async function proposeGroupings(
  importId: string,
  options?: { adapter?: GroupingLlmAdapter }
): Promise<ActionResult<ProposeGroupingsResult>> {
  if (!importId || typeof importId !== 'string') {
    return { success: false, error: 'Ogiltigt import-ID' }
  }
  if (!isGroupingsFeatureEnabled()) {
    return { success: false, error: 'FEATURE_DISABLED' }
  }

  try {
    return await withWorkspace(async (ctx) => {
      const importRow = await prisma.lawListImport.findFirst({
        where: { id: importId, workspace_id: ctx.workspaceId },
        select: { id: true, status: true },
      })
      if (!importRow) {
        return { success: false, error: 'IMPORT_NOT_FOUND' }
      }
      if (importRow.status !== ImportStatus.AWAITING_REVIEW) {
        return { success: false, error: 'WRONG_STATUS' }
      }

      // Hydrate committable rows + the matched-document metadata the
      // proposer needs.
      const rows = await prisma.lawListImportRow.findMany({
        where: {
          import_id: importRow.id,
          match_status: {
            in: [
              RowMatchStatus.ACCEPTED_BY_USER,
              RowMatchStatus.REPLACED_BY_USER,
            ],
          },
          matched_document_id: { not: null },
        },
        select: {
          id: true,
          source_omrade: true,
          matched_document_id: true,
          matched_document: {
            select: {
              title: true,
              document_number: true,
              content_type: true,
            },
          },
        },
      })

      if (rows.length < GROUPING_SIZE_GATE) {
        return { success: false, error: 'GATE_NOT_MET' }
      }

      const proposerInput: GroupingProposerRow[] = rows.map((r) => ({
        rowId: r.id,
        sourceOmrade: r.source_omrade,
        matchedDocumentId: r.matched_document_id,
        title: r.matched_document?.title ?? null,
        documentNumber: r.matched_document?.document_number ?? null,
        contentType: r.matched_document?.content_type ?? null,
      }))

      const adapter = options?.adapter ?? createGroupingLlmAdapter()
      const proposal = await proposeGroupingsForRows(proposerInput, adapter)

      // Telemetry write — Anthropic-only fields filled when llmUsed === true.
      // Wrapped in try/catch per Story 14.27 — failure-to-write is logged
      // but never re-thrown.
      if (proposal.llmUsed && proposal.llmUsage) {
        try {
          const cost = estimateCostUsd({
            model: GROUPING_LLM_TELEMETRY_NAME,
            inputTokens: proposal.llmUsage.inputTokens,
            outputTokens: proposal.llmUsage.outputTokens,
            cacheReadInputTokens: proposal.llmUsage.cacheReadInputTokens,
            cacheWriteInputTokens: proposal.llmUsage.cacheWriteInputTokens,
            reasoningTokens: 0,
          })
          await prisma.chatUsageEvent.create({
            data: {
              workspace_id: ctx.workspaceId,
              user_id: ctx.userId,
              model: GROUPING_LLM_TELEMETRY_NAME,
              // Story 24.7 — IMPORT_GROUPING enum value added in
              // 20260508120000_add_import_grouping_chat_context migration.
              // String literal cast keeps TS happy when the generated
              // Prisma client hasn't been refreshed yet on Windows
              // (query-engine DLL hot-reload constraint).
              context_type: 'IMPORT_GROUPING' as never,
              input_tokens: proposal.llmUsage.inputTokens,
              output_tokens: proposal.llmUsage.outputTokens,
              cache_read_input_tokens: proposal.llmUsage.cacheReadInputTokens,
              cache_write_input_tokens: proposal.llmUsage.cacheWriteInputTokens,
              reasoning_tokens: 0,
              step_count: 1,
              cost_usd_estimate: cost,
            },
          })
        } catch (err) {
          console.error('[CHAT_USAGE_EVENT_WRITE_FAIL]', err)
        }
      }

      // Activity log — emitted on EVERY successful return (incl. degraded).
      try {
        await logActivity(
          ctx.workspaceId,
          ctx.userId,
          'law_list_import',
          importRow.id,
          'law_list_import.groupings_proposed',
          null,
          {
            tier1Count: proposal.tier1Count,
            tier2Count: proposal.tier2Count,
            unassignedCount: proposal.unassignedCount,
            llmUsed: proposal.llmUsed,
            ...(proposal.llmDurationMs !== undefined
              ? { llmDurationMs: proposal.llmDurationMs }
              : {}),
            ...(proposal.llmFailureReason
              ? { llmFailureReason: proposal.llmFailureReason }
              : {}),
          }
        )
      } catch (err) {
        // Non-fatal; activity-log failures must never break the user flow.
        console.error('proposeGroupings activity-log write failed:', err)
      }

      return {
        success: true,
        data: {
          groups: proposal.groups,
          unassigned: proposal.unassigned,
          generatedAt: proposal.generatedAt,
          llmUsed: proposal.llmUsed,
          ...(proposal.llmFailureReason
            ? { llmFailureReason: proposal.llmFailureReason }
            : {}),
        },
      }
    }, 'tasks:edit')
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === 'ACCESS_DENIED'
    ) {
      return { success: false, error: 'FORBIDDEN' }
    }
    console.error('proposeGroupings error:', err)
    return { success: false, error: 'Kunde inte föreslå grupper' }
  }
}

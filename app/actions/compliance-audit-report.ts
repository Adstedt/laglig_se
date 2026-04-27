'use server'

/**
 * Story 21.11 — Revisionsrapport preview data-fetch action.
 *
 * Read-only, non-persistent: loads cycle + items + findings + evidence
 * snapshots, pre-renders HTML server-side, returns both the input + the HTML
 * so the Rapport-tab client component can display it in a sandboxed iframe
 * without a second round-trip.
 *
 * Architecture §5.1 reserves this module for report + PDF work; Story 21.12
 * will add `generateCycleReport` + `downloadCycleReport` alongside this read
 * action (they will persist `ComplianceAuditReport` rows + run Puppeteer).
 * See `docs/stories/21.11.revisionsrapport-html-renderer.md` "Action-name
 * deviation from architecture §5.1" for rationale.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { ComplianceCycleStatus, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import { logActivity } from '@/lib/services/activity-logger'
import {
  renderRevisionsrapport,
  type EvidenceSnapshotRow,
  type RevisionsrapportInput,
} from '@/lib/compliance-audit/revisionsrapport-renderer'
import { renderRevisionsrapportPdf } from '@/lib/compliance-audit/revisionsrapport-to-pdf'
import { reportNeedsRegeneration } from '@/lib/compliance-audit/report-staleness'
import { getCycleById } from './compliance-audit-cycle'
import { getCycleItemsForCycle } from './compliance-audit-item'
import { listFindingsForCycle } from './compliance-finding'

const REPORT_STORAGE_BUCKET = 'workspace-files'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface GetRevisionsrapportInputResult {
  input: RevisionsrapportInput
  html: string
}

// ============================================================================
// Zod schema
// ============================================================================

const GetRevisionsrapportInputSchema = z.object({
  cycleId: z.string().uuid(),
})

// ============================================================================
// Module-private helpers
// ============================================================================

/**
 * Tenant-scoped evidence-snapshot loader. Joins `ComplianceEvidenceSnapshot` →
 * `WorkspaceFile` / `WorkspaceDocument` and filters by the cycle's workspace
 * through the nested relation filter (matches the `getCycleById` tenant
 * isolation pattern at `compliance-audit-cycle.ts:437-474`).
 *
 * Returns an empty array for non-SEALED cycles — 21.9 hydrates these rows as
 * part of the seal transaction; before seal there are none to read.
 */
async function loadEvidenceSnapshotsForCycle(
  cycleId: string,
  workspaceId: string
): Promise<EvidenceSnapshotRow[]> {
  const rows = await prisma.complianceEvidenceSnapshot.findMany({
    where: {
      cycle_id: cycleId,
      cycle: { workspace_id: workspaceId },
    },
    include: {
      evidence_file: { select: { id: true, filename: true } },
      evidence_document: { select: { id: true, title: true } },
    },
    orderBy: { captured_at: 'asc' },
  })

  return rows.map((row) => ({
    id: row.id,
    lawListItemId: row.law_list_item_id,
    requirementId: row.requirement_id,
    evidenceKind: row.evidence_kind,
    evidenceSha256: row.evidence_sha256,
    capturedAt: row.captured_at,
    displayName:
      row.evidence_file?.filename ?? row.evidence_document?.title ?? '—',
  }))
}

// ============================================================================
// getRevisionsrapportInput (Story 21.11 AC 3)
// ============================================================================

export async function getRevisionsrapportInput(input: {
  cycleId: string
}): Promise<ActionResult<GetRevisionsrapportInputResult>> {
  const parsed = GetRevisionsrapportInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  try {
    return await withWorkspace(async (ctx) => {
      if (
        !(ctx.hasPermission('activity:view') || ctx.hasPermission('tasks:edit'))
      ) {
        return { success: false, error: 'Behörighet saknas' }
      }

      // Parallel data load — single round-trip clump.
      const [cycleResult, itemsResult, findingsResult, snapshots] =
        await Promise.all([
          getCycleById(parsed.data.cycleId),
          getCycleItemsForCycle(parsed.data.cycleId),
          listFindingsForCycle({ cycleId: parsed.data.cycleId }),
          loadEvidenceSnapshotsForCycle(parsed.data.cycleId, ctx.workspaceId),
        ])

      // Propagate first downstream failure (Swedish) so the caller surfaces
      // a meaningful error instead of a generic internal failure.
      if (!cycleResult.success || !cycleResult.data) {
        return {
          success: false,
          error: cycleResult.error ?? 'Kontrollen hittades inte',
        }
      }
      if (!itemsResult.success || !itemsResult.data) {
        return {
          success: false,
          error: itemsResult.error ?? 'Kunde inte hämta kontrollens dokument',
        }
      }
      if (!findingsResult.success || !findingsResult.data) {
        return {
          success: false,
          error: findingsResult.error ?? 'Kunde inte hämta anmärkningar',
        }
      }

      const rendererInput: RevisionsrapportInput = {
        cycle: cycleResult.data.cycle,
        items: itemsResult.data.items,
        findings: findingsResult.data.findings,
        snapshots,
        workspace: { id: ctx.workspaceId, name: ctx.workspaceName },
        generatedAt: new Date().toISOString(),
      }

      const html = renderRevisionsrapport(rendererInput)

      return {
        success: true,
        data: { input: rendererInput, html },
      }
    }, 'read')
  } catch (error) {
    console.error('getRevisionsrapportInput error:', error)
    return { success: false, error: 'Kunde inte hämta revisionsrapport' }
  }
}

// ============================================================================
// Story 21.12 — generateCycleReport: PDF render + storage upload + DB upsert
// ============================================================================

export interface GenerateCycleReportResult {
  pdfStoragePath: string
  htmlStoragePath: string
  generatedAt: string
  durationMs: number
}

const GenerateCycleReportSchema = z.object({
  cycleId: z.string().uuid(),
  kind: z.enum(['COMPLETE', 'SEALED']),
})

/**
 * Load the most-recent `updated_at` across cycle + items + findings for the
 * COMPLETE-kind staleness check. Parallel `findFirst` queries keep this in
 * the TypeScript layer (no raw SQL) at trivial latency cost.
 */
async function loadMostRecentCycleTouch(
  cycleId: string,
  workspaceId: string
): Promise<number | null> {
  const [cycleRow, itemRow, findingRow] = await Promise.all([
    prisma.complianceAuditCycle.findFirst({
      where: { id: cycleId, workspace_id: workspaceId },
      select: { updated_at: true },
    }),
    prisma.complianceAuditItem.findFirst({
      where: { cycle_id: cycleId, cycle: { workspace_id: workspaceId } },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    }),
    prisma.complianceFinding.findFirst({
      where: { cycle_id: cycleId, cycle: { workspace_id: workspaceId } },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    }),
  ])

  const timestamps = [
    cycleRow?.updated_at?.getTime() ?? null,
    itemRow?.updated_at?.getTime() ?? null,
    findingRow?.updated_at?.getTime() ?? null,
  ].filter((v): v is number => v !== null)

  if (timestamps.length === 0) return null
  return Math.max(...timestamps)
}

/**
 * Build the COMPLETE-kind manifest from the renderer input. Unlike the
 * SEALED manifest (canonicalize + SHA-256 over `CycleSealInput` in Story
 * 21.9), this is an operational archival copy — plain-JSON serialisation is
 * sufficient. The seal transaction remains the sole authority for the SEALED
 * manifest field; `generateCycleReport` never overwrites it.
 */
function buildComplianceReportManifest(
  input: RevisionsrapportInput
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
}

function buildReportStoragePath(
  workspaceId: string,
  cycleId: string,
  kind: 'COMPLETE' | 'SEALED',
  extension: 'pdf' | 'html'
): string {
  // Deterministic UTC timestamp — ISO string (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  // stripped of non-digits then sliced to YYYYMMDDHHmmss (14 chars).
  // Note: the non-digit character class is deliberate — the hyphen-colon
  // literal form is picked up by Tailwind's content scanner as an
  // arbitrary-class candidate and breaks the CSS build.
  const now = new Date()
  const timestamp = now
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  return `compliance-audit-reports/${workspaceId}/${cycleId}/report-${timestamp}-${kind.toLowerCase()}.${extension}`
}

/**
 * Story 21.12 AC 1 — generate + persist the revisionsrapport.
 *
 * Flow:
 *   1. Load pre-rendered HTML via Story 21.11's `getRevisionsrapportInput`.
 *   2. Render to PDF bytes via `renderRevisionsrapportPdf`.
 *   3. Upload `.pdf` + `.html` in parallel to Supabase Storage.
 *   4. Upsert `ComplianceAuditReport` — on SEALED kind the `manifest` field
 *      is intentionally omitted from the update branch so the seal
 *      transaction's canonical manifest is never clobbered.
 *   5. Write a `cycle_report_generated` ActivityLog row.
 *   6. Revalidate the cycle detail page so the Rapport tab picks up the
 *      new path on next navigation.
 */
export async function generateCycleReport(input: {
  cycleId: string
  kind: 'COMPLETE' | 'SEALED'
}): Promise<ActionResult<GenerateCycleReportResult>> {
  const parsed = GenerateCycleReportSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Valideringsfel',
    }
  }

  const { cycleId, kind } = parsed.data
  const startedAt = Date.now()

  try {
    return await withWorkspace(async (ctx) => {
      // Status gate: verify cycle exists + is past PLANERAD/PAGAENDE.
      const cycle = await prisma.complianceAuditCycle.findFirst({
        where: { id: cycleId, workspace_id: ctx.workspaceId },
        select: { id: true, status: true },
      })

      if (!cycle) {
        return { success: false, error: 'Kontrollen hittades inte' }
      }

      if (
        cycle.status === ComplianceCycleStatus.PLANERAD ||
        cycle.status === ComplianceCycleStatus.PAGAENDE
      ) {
        return {
          success: false,
          error: 'Rapport kan inte genereras innan kontrollen är slutförd',
        }
      }

      if (
        kind === 'SEALED' &&
        cycle.status !== ComplianceCycleStatus.SEALED &&
        cycle.status !== ComplianceCycleStatus.ARKIVERAD
      ) {
        return {
          success: false,
          error:
            'SEALED-rapport kan endast genereras för fastställda kontroller',
        }
      }

      // 1. Load + render HTML (reuse Story 21.11 action).
      const inputResult = await getRevisionsrapportInput({ cycleId })
      if (!inputResult.success || !inputResult.data) {
        return {
          success: false,
          error: inputResult.error ?? 'Kunde inte hämta revisionsrapport',
        }
      }

      const { input: rendererInput, html } = inputResult.data

      // 2. Render PDF.
      const pdfBuffer = await renderRevisionsrapportPdf(html, {
        cycleIdShort: cycleId.slice(0, 8),
        generatedAt: rendererInput.generatedAt,
        sealHash: rendererInput.cycle.sealHash ?? null,
      })

      // 3. Upload to Supabase Storage in parallel.
      const pdfPath = buildReportStoragePath(
        ctx.workspaceId,
        cycleId,
        kind,
        'pdf'
      )
      const htmlPath = buildReportStoragePath(
        ctx.workspaceId,
        cycleId,
        kind,
        'html'
      )

      const storageClient = getStorageClient()
      const [pdfUpload, htmlUpload] = await Promise.all([
        storageClient.storage
          .from(REPORT_STORAGE_BUCKET)
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          }),
        storageClient.storage
          .from(REPORT_STORAGE_BUCKET)
          .upload(htmlPath, html, {
            contentType: 'text/html; charset=utf-8',
            upsert: true,
          }),
      ])

      if (pdfUpload.error) {
        console.error('PDF storage upload error:', pdfUpload.error)
        return { success: false, error: 'Kunde inte ladda upp PDF-rapporten' }
      }
      if (htmlUpload.error) {
        console.error('HTML storage upload error:', htmlUpload.error)
        return {
          success: false,
          error: 'Kunde inte ladda upp HTML-rapporten',
        }
      }

      // 4. Upsert ComplianceAuditReport row.
      // INVARIANT (Story 21.12 + 21.9): sealCycle is the sole authority for
      // the canonical SEALED manifest. generateCycleReport must NEVER author
      // a manifest for SEALED-kind rows — neither on update nor on create.
      // QA gate INVARIANT-001 hardening: split SEALED (pure update, no
      // manifest field) from COMPLETE (upsert with freshly-built manifest).
      // The earlier defensive fallback `manifest ?? buildComplianceReportManifest(...)`
      // was removed because it could silently write a non-canonical manifest
      // if the seal-row was ever absent.
      const existing = await prisma.complianceAuditReport.findUnique({
        where: {
          cycle_id_report_kind: { cycle_id: cycleId, report_kind: kind },
        },
        select: { id: true, pdf_storage_path: true },
      })
      const previousPdfPath = existing?.pdf_storage_path ?? null

      // SEALED requires the seal-row to pre-exist. If sealCycle has not
      // populated the canonical manifest yet, refuse rather than fall back.
      if (kind === 'SEALED' && !existing) {
        return {
          success: false,
          error:
            'SEALED-rapport saknar seal-transaktion — manifest måste skrivas av sealCycle först',
        }
      }

      const generatedAtDate = new Date()
      let report: { id: string }
      if (kind === 'SEALED') {
        // Pure update — `existing` is non-null per the guard above, so no
        // create branch is needed. The canonical manifest from sealCycle is
        // never touched.
        report = await prisma.complianceAuditReport.update({
          where: {
            cycle_id_report_kind: {
              cycle_id: cycleId,
              report_kind: 'SEALED',
            },
          },
          data: {
            generated_at: generatedAtDate,
            pdf_storage_path: pdfPath,
            html_storage_path: htmlPath,
          },
          select: { id: true },
        })
      } else {
        // COMPLETE: upsert with freshly-built operational manifest. The
        // create branch fires on first generation; the update branch fires
        // on regen after a content edit (SF-3 covers revert-and-recomplete).
        const manifest = buildComplianceReportManifest(rendererInput)
        report = await prisma.complianceAuditReport.upsert({
          where: {
            cycle_id_report_kind: {
              cycle_id: cycleId,
              report_kind: 'COMPLETE',
            },
          },
          create: {
            cycle_id: cycleId,
            report_kind: 'COMPLETE',
            generated_at: generatedAtDate,
            pdf_storage_path: pdfPath,
            html_storage_path: htmlPath,
            manifest,
          },
          update: {
            generated_at: generatedAtDate,
            pdf_storage_path: pdfPath,
            html_storage_path: htmlPath,
            manifest,
          },
          select: { id: true },
        })
      }

      const durationMs = Date.now() - startedAt

      // 5. ActivityLog. Entity is the cycle (reader's focus), report id in
      // new_value for ops linkability.
      await logActivity(
        ctx.workspaceId,
        ctx.userId,
        'compliance_audit_cycle',
        cycleId,
        'cycle_report_generated',
        { pdfStoragePath: previousPdfPath },
        { pdfStoragePath: pdfPath, kind, durationMs, reportId: report.id }
      )

      // 6. Revalidate cycle detail — backticks, not single quotes.
      revalidatePath(`/laglistor/kontroller/${cycleId}`)

      return {
        success: true,
        data: {
          pdfStoragePath: pdfPath,
          htmlStoragePath: htmlPath,
          generatedAt: generatedAtDate.toISOString(),
          durationMs,
        },
      }
    }, 'tasks:edit')
  } catch (error) {
    console.error('generateCycleReport error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Kunde inte generera revisionsrapport',
    }
  }
}

/**
 * Helper for the route handler: resolve whether regeneration is needed.
 * Loads the existing report row + computes `mostRecentTouch` and delegates
 * to `reportNeedsRegeneration`. Exported because the route handler needs
 * this decision before deciding whether to call `generateCycleReport`.
 */
export async function shouldRegenerateReport(
  cycleId: string,
  workspaceId: string,
  kind: 'COMPLETE' | 'SEALED'
): Promise<boolean> {
  const [report, mostRecentTouchMs] = await Promise.all([
    prisma.complianceAuditReport.findUnique({
      where: {
        cycle_id_report_kind: { cycle_id: cycleId, report_kind: kind },
      },
      select: {
        pdf_storage_path: true,
        report_kind: true,
        generated_at: true,
      },
    }),
    loadMostRecentCycleTouch(cycleId, workspaceId),
  ])

  return reportNeedsRegeneration(report, mostRecentTouchMs)
}

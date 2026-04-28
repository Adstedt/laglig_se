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
 * Story 21.26 — `loadEvidenceSnapshotsForCycle` removed alongside the
 * ComplianceEvidenceSnapshot model deletion. The renderer no longer reads
 * snapshot data; an empty array is supplied as a transitional placeholder.
 */
async function loadEvidenceSnapshotsForCycle(
  _cycleId: string,
  _workspaceId: string
): Promise<EvidenceSnapshotRow[]> {
  return []
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

// Story 21.26 — `kind` collapses to a single value. Kept as a const so the
// schema shape stays stable for callers; downstream code treats it as
// effectively unconditional.
const GenerateCycleReportSchema = z.object({
  cycleId: z.string().uuid(),
  kind: z.enum(['COMPLETE']),
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
  kind: 'COMPLETE',
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
  kind: 'COMPLETE'
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

      // Story 21.26 — SEALED-specific status gate removed alongside the
      // SEAL collapse. Only COMPLETE kind exists.

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
        // Story 21.26 — sealHash always null post-collapse. Renderer keeps
        // the parameter to preserve its signature; just passes null.
        sealHash: null,
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

      // 4. Story 21.26 — Upsert ComplianceAuditReport row.
      // SEALED-specific branch removed alongside the SEAL collapse. COMPLETE
      // is the only remaining kind; manifest is built fresh on every gen.
      const existing = await prisma.complianceAuditReport.findUnique({
        where: {
          cycle_id_report_kind: { cycle_id: cycleId, report_kind: kind },
        },
        select: { id: true, pdf_storage_path: true },
      })
      const previousPdfPath = existing?.pdf_storage_path ?? null

      const generatedAtDate = new Date()
      const manifest = buildComplianceReportManifest(rendererInput)
      const report = await prisma.complianceAuditReport.upsert({
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
  kind: 'COMPLETE'
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

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
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import {
  renderRevisionsrapport,
  type EvidenceSnapshotRow,
  type RevisionsrapportInput,
} from '@/lib/compliance-audit/revisionsrapport-renderer'
import { getCycleById } from './compliance-audit-cycle'
import { getCycleItemsForCycle } from './compliance-audit-item'
import { listFindingsForCycle } from './compliance-finding'

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

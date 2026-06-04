/**
 * list_workspace_documents tool — Story 17.10 + extended by Story 17.18 AC 6.
 *
 * Use cases:
 *   - "what styrdokument do we have for this law/task?"
 *   - "list our policies in draft status"
 *   - "show me documents tagged to kravpunkt X"
 *   - **Story 17.18:** "which policies are being revised right now?" via the
 *     new `dual_state_only` filter — single tool call instead of enumerate-
 *     all-then-filter-in-reasoning.
 *
 * Filters (AC 13 + Story 17.18 AC 6): type + status + dualStateOnly +
 * link-based filters. Workspace-scoped (AC 16).
 *
 * Ordered by `updated_at desc`; capped at 25 results (AC 15).
 *
 * **Story 17.18 AC 6 — extended row shape:** every row now exposes the
 * dual-pointer state (`currentApprovedVersionNumber`, `currentDraftVersionNumber`,
 * `draftStatus`, `dualState`) so the agent can render "Godkänd v3 + Utkast v4
 * pågår"-style summaries without a separate get_workspace_document call.
 *
 * **NTH-2 ratification:** the `dual_state_only` filter is exposed on the Zod
 * schema (LLM-visible tool spec), not just the server function's TypeScript
 * signature. Verified by the registry-narrowing test which inspects the
 * tool's published input schema.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { WorkspaceDocumentType, WorkspaceDocumentStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'

const listWorkspaceDocumentsSchema = z.object({
  document_type: z
    .nativeEnum(WorkspaceDocumentType)
    .optional()
    .describe(
      'Filter på dokumenttyp (POLICY, ROUTINE, RISK_ASSESSMENT, ACTION_PLAN, INSTRUCTION, CHECKLIST, REPORT, OTHER). Utelämna för att inkludera alla typer.'
    ),
  status: z
    .nativeEnum(WorkspaceDocumentStatus)
    .optional()
    .describe(
      'Filter på status (DRAFT, IN_REVIEW, APPROVED, SUPERSEDED, ARCHIVED). Utelämna för att inkludera alla statusar.'
    ),
  linked_list_item_id: z
    .string()
    .optional()
    .describe(
      'UUID för en laglistpost — endast styrdokument som är länkade till denna laglistpost returneras.'
    ),
  linked_task_id: z
    .string()
    .optional()
    .describe(
      'UUID för en uppgift — endast styrdokument som är länkade till denna uppgift returneras.'
    ),
  dual_state_only: z
    .boolean()
    .optional()
    .describe(
      'Story 17.18: när true returneras ENDAST dokument med pågående revision (både en godkänd version OCH ett pågående utkast). Användbart för "Vilka policyer pågår just nu revisions på?". Utelämna för att inkludera alla.'
    ),
})

type ListWorkspaceDocumentsInput = z.infer<typeof listWorkspaceDocumentsSchema>

const MAX_RESULTS = 25

export function createListWorkspaceDocumentsTool(workspaceId: string) {
  return tool({
    description: `Lista styrdokument i arbetsytan, valfritt filtrerade på typ, status, dubbeltillstånd, eller länkning till en specifik uppgift/laglistpost.

Använd när du vill bläddra bland existerande styrdokument utan en specifik sökfråga — t.ex. "vilka rutiner har vi?", "vilka utkast ligger för granskning?", "vilka policyer pågår just nu revisions på?" (\`dual_state_only: true\`), eller "vilka styrdokument är kopplade till den här lagen/uppgiften?". Använd \`search_workspace_documents\` istället när du har en sökfråga, och \`get_workspace_document\` när du vill läsa hela innehållet.

Returnerar upp till ${MAX_RESULTS} styrdokument sorterade efter senast uppdaterade. För varje träff: titel, dokumenttyp, status, godkänd versionsnummer (om finns), utkasts-versionsnummer (om pågår), utkasts-status, om dokumentet är i dubbeltillstånd, antal versioner, senaste uppdateringen, och skapare.`,
    inputSchema: zodSchema(listWorkspaceDocumentsSchema),
    execute: async (input: ListWorkspaceDocumentsInput) => {
      const startTime = Date.now()
      const {
        document_type,
        status,
        linked_list_item_id,
        linked_task_id,
        dual_state_only,
      } = input

      try {
        const where: Prisma.WorkspaceDocumentWhereInput = {
          workspace_id: workspaceId,
          ...(document_type !== undefined && { document_type }),
          ...(status !== undefined && { status }),
          ...(linked_task_id !== undefined && {
            task_links: { some: { task_id: linked_task_id } },
          }),
          ...(linked_list_item_id !== undefined && {
            list_item_links: { some: { list_item_id: linked_list_item_id } },
          }),
          // Story 17.18 AC 6: dual-state filter. A doc is in dual state iff
          // BOTH current_approved_version_id AND current_draft_version_id are
          // populated. Translated to Prisma: `not: null` on both pointer cols.
          ...(dual_state_only === true && {
            current_approved_version_id: { not: null },
            current_draft_version_id: { not: null },
          }),
        }

        const rows = await prisma.workspaceDocument.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          take: MAX_RESULTS,
          select: {
            id: true,
            title: true,
            document_type: true,
            status: true,
            updated_at: true,
            creator: { select: { name: true } },
            _count: { select: { versions: true } },
            // Story 17.18 AC 6: dual-pointer fields surface on every row so
            // the agent can render the composite state inline.
            current_approved_version_id: true,
            current_draft_version_id: true,
            draft_status: true,
            current_approved_version: { select: { version_number: true } },
            current_draft_version: { select: { version_number: true } },
          },
        })

        const results = rows.map((r) => ({
          documentId: r.id,
          title: r.title,
          documentType: r.document_type,
          status: r.status,
          versionCount: r._count.versions,
          lastUpdated: r.updated_at,
          createdBy: r.creator?.name ?? null,
          // Story 17.18 AC 6: dual-pointer summary fields.
          currentApprovedVersionNumber:
            r.current_approved_version?.version_number ?? null,
          currentDraftVersionNumber:
            r.current_draft_version?.version_number ?? null,
          // Coerce undefined → null so the response shape is stable for callers.
          draftStatus: r.draft_status ?? null,
          dualState:
            r.current_approved_version_id != null &&
            r.current_draft_version_id != null,
        }))

        return wrapToolResponse('list_workspace_documents', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_workspace_documents',
          `Kunde inte hämta styrdokumentlistan: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

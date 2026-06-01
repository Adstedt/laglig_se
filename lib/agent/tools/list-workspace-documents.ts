/**
 * list_workspace_documents tool — Story 17.10: enumerate a workspace's
 * authored styrdokument without a semantic-search query.
 *
 * Use cases:
 *   - "what styrdokument do we have for this law/task?"
 *   - "list our policies in draft status"
 *   - "show me documents tagged to kravpunkt X"
 *
 * Filters (AC 13): type + status are direct `where` clauses on the
 * `WorkspaceDocument` columns; the two `linked_*` filters go through the
 * established relations (`task_links` / `list_item_links`) using Prisma's
 * `some` operator. Workspace-scoped (AC 16) — the closure `workspaceId` is
 * the only tenant source.
 *
 * Ordered by `updated_at desc`; capped at 25 results (AC 15) — for deeper
 * exploration the agent uses `search_workspace_documents` (semantic) or
 * `get_workspace_document` (single).
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
})

type ListWorkspaceDocumentsInput = z.infer<typeof listWorkspaceDocumentsSchema>

const MAX_RESULTS = 25

export function createListWorkspaceDocumentsTool(workspaceId: string) {
  return tool({
    description: `Lista styrdokument i arbetsytan, valfritt filtrerade på typ, status eller länkning till en specifik uppgift/laglistpost.

Använd när du vill bläddra bland existerande styrdokument utan en specifik sökfråga — t.ex. "vilka rutiner har vi?", "vilka utkast ligger för granskning?", eller "vilka styrdokument är kopplade till den här lagen/uppgiften?". Använd \`search_workspace_documents\` istället när du har en sökfråga, och \`get_workspace_document\` när du vill läsa hela innehållet.

Returnerar upp till ${MAX_RESULTS} styrdokument sorterade efter senast uppdaterade. För varje träff: titel, dokumenttyp, status, antal versioner, senaste uppdateringen, och skapare.`,
    inputSchema: zodSchema(listWorkspaceDocumentsSchema),
    execute: async (input: ListWorkspaceDocumentsInput) => {
      const startTime = Date.now()
      const { document_type, status, linked_list_item_id, linked_task_id } =
        input

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

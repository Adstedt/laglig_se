/**
 * add_document_section tool — Story 17.11b: propose ADDING a NEW section to an
 * existing workspace document.
 *
 * Always proposes a PendingAgentAction of type ADD_DOCUMENT_SECTION (inline
 * approval only — no `execute: true` direct write, mirrors 14.23/14.24/14.28/
 * 17.11's pattern). On approval, dispatch re-asserts the DRAFT/IN_REVIEW + no-
 * duplicate-heading + position-target guards, calls `addSection()` to produce
 * the full updated `contentJson`, then calls the existing `saveDocumentVersion`
 * server action — which appends a new `WorkspaceDocumentVersion`, bumps
 * `current_version_*`, writes the `document_version_saved` ActivityLog row,
 * and triggers `indexWorkspaceDocument` via Next.js `after()`.
 *
 * Tool-time guards (AC 4): target document is in the caller's workspace; status
 * is DRAFT or IN_REVIEW (APPROVED/SUPERSEDED/ARCHIVED → guide to
 * `createDraftFromApproved`); document has a current version; the new heading
 * does NOT already exist (case-insensitive); the new body is non-empty; the
 * `position.heading` (when `at` ∈ {after,before}) exists.
 *
 * params (AC 2): `{ documentId, documentTitle, newSectionHeading,
 * newSectionLevel, newSectionContentJson, position, changeSummary,
 * entity_version }`. `documentTitle` is carried so the renderer can name the
 * document in natural Swedish copy per CP-001; 14.31's staleness guard
 * consumes `entity_version` (ISO-8601 UTC, the document's `updated_at`).
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'
import {
  hasSection,
  type InsertPosition,
  type TiptapDocumentJSON,
  type TiptapNode,
} from '@/lib/documents/update-document-section'

const positionSchema = z.discriminatedUnion('at', [
  z.object({ at: z.literal('start') }),
  z.object({ at: z.literal('end') }),
  z.object({ at: z.literal('after'), heading: z.string().min(1) }),
  z.object({ at: z.literal('before'), heading: z.string().min(1) }),
])

const schema = z.object({
  document_id: z
    .string()
    .uuid()
    .describe('ID för WorkspaceDocument som ska få det nya avsnittet.'),
  new_section_heading: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'Rubriktext för det NYA avsnittet (t.ex. "Syfte"). Måste vara unik i dokumentet (case-insensitivt).'
    ),
  new_section_level: z
    .number()
    .int()
    .min(1)
    .max(6)
    .describe('Rubriknivå för det nya avsnittet (h1..h6).'),
  new_section_content: z
    .any()
    .describe(
      'Tiptap-/ProseMirror-JSON för det nya avsnittets BODY (det som kommer efter rubriken). Antingen en array av block-noder ([paragraph, ...]) eller ett doc-node {type:"doc", content:[...]}. Skicka INTE med rubriken — den genereras automatiskt utifrån new_section_heading + new_section_level.'
    ),
  change_summary: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'Kort beskrivning av tillägget (visas i versionshistoriken och godkännandekortet).'
    ),
  position: positionSchema.describe(
    'Var det nya avsnittet ska placeras. Antingen "start"/"end" eller "after"/"before" med en heading-referens (case-insensitivt).'
  ),
})

type Input = z.infer<typeof schema>

/**
 * Normalize the model's `new_section_content` into a TiptapNode[] of body
 * nodes. The agent may emit a bare array, a doc node, or a single block —
 * accept all three so a valid edit isn't falsely rejected. Returns null if
 * unparseable.
 */
function normalizeBodyNodes(input: unknown): TiptapNode[] | null {
  let cj: unknown = input
  if (typeof cj === 'string') {
    try {
      cj = JSON.parse(cj)
    } catch {
      return null
    }
  }
  if (Array.isArray(cj)) return cj as TiptapNode[]
  if (cj && typeof cj === 'object') {
    const node = cj as TiptapNode
    if (node.type === 'doc' && Array.isArray(node.content)) {
      return node.content
    }
    if (typeof node.type === 'string') return [node]
  }
  return null
}

function tiptapToPlainText(nodes: TiptapNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.content)) return tiptapToPlainText(n.content)
      return ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function positionContextSv(position: InsertPosition): string {
  switch (position.at) {
    case 'start':
      return 'först i dokumentet'
    case 'end':
      return 'sist i dokumentet'
    case 'after':
      return `efter "${position.heading}"`
    case 'before':
      return `före "${position.heading}"`
  }
}

export function createAddDocumentSectionTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Föreslå att LÄGGA TILL ett NYTT avsnitt i ett befintligt styrdokument (WorkspaceDocument).

Använd när användaren vill UTÖKA ett dokument med en sektion som inte finns ännu — t.ex. "lägg till ett Syfte-avsnitt" eller "lägg till en ansvarsfördelning". För att ÄNDRA en befintlig sektion: använd istället \`update_document\`. För ett HELT NYTT dokument: använd istället \`draft_styrdokument\`.

Endast DRAFT eller IN_REVIEW kan ändras. Godkända (APPROVED), upphävda eller arkiverade dokument måste först förgrenas till en ny version av användaren (createDraftFromApproved) innan agenten kan föreslå tillägg.

Skicka rubriktexten i \`new_section_heading\`, rubriknivån (1–6) i \`new_section_level\`, och den nya sektionens BODY i \`new_section_content\` (Tiptap-JSON — array av block-noder eller ett doc-node). Skicka INTE med rubriken igen i body:n — den genereras automatiskt. Ange positionen i \`position\`: { at: "start" | "end" } eller { at: "after" | "before", heading: "..." } (heading matchas case-insensitivt).

Detta skapar alltid ett förslag som användaren godkänner i chatten — tillägget sparas först efter godkännande. Läs dokumentets nuläge med get_workspace_document innan du föreslår, så du vet vilka rubriker som redan finns.`,
    inputSchema: zodSchema(schema),
    execute: async ({
      document_id,
      new_section_heading,
      new_section_level,
      new_section_content,
      change_summary,
      position,
    }: Input) => {
      const startTime = Date.now()

      // Story 17.16 AC 9: workspace-scoped read with the dual-pointer fields.
      // Content source = draft pointer when set, else approved (never-approved
      // DRAFT case). NEVER read current_version.content_json (the deprecated
      // alias) — see update-document.ts AC 8 for the full rationale.
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: document_id, workspace_id: workspaceId },
        select: {
          id: true,
          title: true,
          status: true,
          updated_at: true,
          current_version_number: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          current_draft_version: { select: { content_json: true } },
          current_approved_version: { select: { content_json: true } },
        },
      })
      if (!document) {
        return wrapToolError(
          'add_document_section',
          'Dokumentet hittades inte.',
          'Kontrollera att ID:t är korrekt och att dokumentet tillhör arbetsytan.',
          startTime
        )
      }

      // Story 17.11c AC 4 — writeable predicate widens to also accept
      // APPROVED-with-no-draft (atomic auto-branch on approve). Same 3-shape
      // matrix as update-document.ts.
      const autoBranchEligible =
        document.status === 'APPROVED' &&
        document.current_draft_version_id == null
      const writeable =
        document.current_draft_version_id != null ||
        (document.status === 'DRAFT' &&
          document.current_approved_version_id == null) ||
        autoBranchEligible
      if (!writeable) {
        return wrapToolError(
          'add_document_section',
          `Dokumentet kan inte ändras i status "${document.status}".`,
          'Endast utkast (DRAFT/IN_REVIEW) eller godkända dokument utan pågående utkast kan utökas av agenten. Upphävda eller arkiverade dokument kan inte ändras.',
          startTime
        )
      }

      const currentContent = (document.current_draft_version?.content_json ??
        document.current_approved_version?.content_json) as
        | TiptapDocumentJSON
        | null
        | undefined
      if (!currentContent || !Array.isArray(currentContent.content)) {
        return wrapToolError(
          'add_document_section',
          'Dokumentet saknar en aktuell version att lägga till i.',
          'Be användaren öppna och spara dokumentet en gång i editorn innan agenten föreslår tillägg.',
          startTime
        )
      }

      // AC 4: duplicate-heading guard. Refuse with a Swedish error pointing the
      // agent at update_document for the edit-existing-section path.
      if (hasSection(currentContent, new_section_heading)) {
        return wrapToolError(
          'add_document_section',
          `Avsnittet "${new_section_heading}" finns redan i dokumentet.`,
          'Använd update_document för att redigera ett befintligt avsnitt, eller välj en annan rubrik för det nya avsnittet.',
          startTime
        )
      }

      // AC 4: position-target heading must exist for at:after/before. Refuse
      // before persisting any row so the agent can retry with a valid target.
      if (position.at === 'after' || position.at === 'before') {
        if (!hasSection(currentContent, position.heading)) {
          return wrapToolError(
            'add_document_section',
            `Rubriken "${position.heading}" finns inte i dokumentet — kan inte positionera det nya avsnittet.`,
            'Använd den exakta rubriktexten som finns i dokumentet (matchas case-insensitivt). Läs dokumentet med get_workspace_document för att se rubrikerna.',
            startTime
          )
        }
      }

      // Normalize the agent's `new_section_content` into TiptapNode[].
      const newSectionContentJson = normalizeBodyNodes(new_section_content)
      if (newSectionContentJson === null) {
        return wrapToolError(
          'add_document_section',
          'Det nya innehållet är inte giltig Tiptap-JSON.',
          'Skicka en array av block-noder ([paragraph, heading, list, ...]) eller ett doc-node {type:"doc", content:[...]}.',
          startTime
        )
      }

      // AC 4: non-empty-body guard. Refuse empty inserts — adding a bare
      // heading with no body is almost certainly a mistake.
      if (newSectionContentJson.length === 0) {
        return wrapToolError(
          'add_document_section',
          'Det nya avsnittet är tomt. Ange minst en stycke text.',
          'Skicka minst en paragraf-/list-/heading-nod i new_section_content.',
          startTime
        )
      }

      const params = {
        documentId: document.id,
        // CP-001: renderer copy uses the document title as natural Swedish.
        documentTitle: document.title,
        newSectionHeading: new_section_heading,
        newSectionLevel: new_section_level,
        newSectionContentJson,
        position,
        changeSummary: change_summary,
        // Story 14.31 staleness guard consumes this ISO-8601 UTC snapshot at
        // approve time — same shape as 17.11's update_document tool.
        entity_version: document.updated_at.toISOString(),
        // Story 17.11c AC 6: dispatch reads creates_draft to fork between plain
        // saveDocumentVersion and the new createDraftFromApprovedWithEdit.
        // Renderer reads both to show the "Skapar nytt utkast v{N+1}" header.
        creates_draft: autoBranchEligible,
        newVersionNumber: document.current_version_number + 1,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'ADD_DOCUMENT_SECTION',
        params
      )

      // Compact preview line for the inline card / decision log.
      const bodyExcerpt = tiptapToPlainText(newSectionContentJson).slice(0, 80)
      const preview =
        `Nytt avsnitt: "${new_section_heading}" (h${new_section_level}, ${positionContextSv(position)}) — ` +
        `${bodyExcerpt || '(tom)'}`

      const envelope = wrapWriteToolResponse(
        'add_document_section',
        'add_document_section',
        params,
        preview,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}

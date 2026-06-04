/**
 * update_document tool — Story 17.11: propose a section-level edit to an
 * existing workspace document.
 *
 * Always proposes a PendingAgentAction of type UPDATE_DOCUMENT (inline approval
 * only — no `execute: true` direct write, mirrors 14.23/14.24/14.28's pattern).
 * On approval, dispatch re-asserts the DRAFT/IN_REVIEW guard, applies
 * `updateSection()` to produce the full updated `contentJson`, then calls the
 * existing `saveDocumentVersion` server action — which appends a new
 * `WorkspaceDocumentVersion`, bumps `current_version_*`, writes the
 * `document_version_saved` ActivityLog row, and triggers `indexWorkspaceDocument`
 * via Next.js `after()` — all in one `$transaction`.
 *
 * Tool-time guards (AC 4): target document is in the caller's workspace; status
 * is DRAFT or IN_REVIEW (APPROVED/SUPERSEDED/ARCHIVED → guide to
 * `createDraftFromApproved`); `section_heading` exists; `newSectionContentJson`
 * is NOT deep-equal to the resolved current section body (no-op rejected).
 *
 * params (AC 2 + AC 6): `{ documentId, documentTitle, sectionHeading,
 * oldSectionContentJson, newSectionContentJson, changeSummary, entity_version }`.
 * The two snapshots let the renderer show a diff without re-fetching (AC 6);
 * `documentTitle` is carried so the renderer can name the document in natural
 * Swedish copy per CP-001 (AC 6); 14.31's staleness guard consumes
 * `entity_version` (ISO-8601 UTC, the document's `updated_at`).
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
  extractSection,
  hasSection,
  type TiptapDocumentJSON,
  type TiptapNode,
} from '@/lib/documents/update-document-section'

const schema = z.object({
  document_id: z
    .string()
    .uuid()
    .describe('ID för WorkspaceDocument som ska uppdateras.'),
  section_heading: z
    .string()
    .min(1)
    .describe(
      'Rubriktext för den sektion som ska ersättas. Matchas case-insensitivt mot heading-noderna i dokumentet.'
    ),
  updated_content: z
    .any()
    .describe(
      'Tiptap-/ProseMirror-JSON för den nya sektionens BODY (det som kommer efter rubriken). Antingen en array av block-noder ([paragraph, ...]) eller ett doc-node {type:"doc", content:[...]}. Rubriken bevaras — skicka inte med rubriken igen.'
    ),
  change_summary: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'Kort beskrivning av ändringen (visas i versionshistoriken och godkännandekortet).'
    ),
})

type Input = z.infer<typeof schema>

/**
 * Normalize the model's `updated_content` into a TiptapNode[] of body nodes.
 * The agent may emit a bare array, a doc node, or a single block — accept all
 * three so a valid edit isn't falsely rejected. Returns null if unparseable.
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

/**
 * Canonical JSON stringify — sorts object keys so two nodes with the same
 * content but different key order compare equal. Used by the no-op-edit guard
 * (AC 4) so an agent re-proposal with cosmetic reordering doesn't survive.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k]
      }
      return sorted
    }
    return val
  })
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

export function createUpdateDocumentTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Föreslå en ÄNDRING av en specifik sektion i ett befintligt styrdokument (WorkspaceDocument).

Använd när användaren vill uppdatera en avsnittstext i ett dokument som redan finns — t.ex. "uppdatera Syfte-avsnittet" eller "skärp ansvarsdelen i policyn". För ett HELT NYTT dokument: använd istället \`draft_styrdokument\`.

Endast DRAFT eller IN_REVIEW kan ändras. Godkända (APPROVED), upphävda eller arkiverade dokument måste först förgrenas till en ny version av användaren (createDraftFromApproved) innan agenten kan föreslå en redigering.

Skicka rubriken som ska redigeras i \`section_heading\` (matchas case-insensitivt) och den nya sektions-BODY:n i \`updated_content\` (Tiptap-JSON — antingen en array av block-noder eller ett doc-node). Rubriken bevaras automatiskt; skicka INTE med rubriken igen.

Detta skapar alltid ett förslag som användaren godkänner i chatten — ändringen sparas först efter godkännande. Läs dokumentets nuläge med get_workspace_document innan du föreslår.`,
    inputSchema: zodSchema(schema),
    execute: async ({
      document_id,
      section_heading,
      updated_content,
      change_summary,
    }: Input) => {
      const startTime = Date.now()

      // Story 17.16 AC 8: workspace-scoped read with the dual-pointer fields.
      // The content the agent's edit is computed against MUST come from
      // current_draft_version when set (draft-in-progress writeable case), or
      // current_approved_version for the never-approved DRAFT case. Do NOT
      // read current_version.content_json (the deprecated alias) — under the
      // corrected Model B semantics, the alias points at the approved version
      // during a revision window, which would cause the agent to compute its
      // diff against approved content while writing to the draft pointer —
      // silent draft corruption.
      const document = await prisma.workspaceDocument.findFirst({
        where: { id: document_id, workspace_id: workspaceId },
        select: {
          id: true,
          title: true,
          status: true,
          updated_at: true,
          current_draft_version_id: true,
          current_approved_version_id: true,
          current_draft_version: { select: { content_json: true } },
          current_approved_version: { select: { content_json: true } },
        },
      })
      if (!document) {
        return wrapToolError(
          'update_document',
          'Dokumentet hittades inte.',
          'Kontrollera att ID:t är korrekt och att dokumentet tillhör arbetsytan.',
          startTime
        )
      }

      // Story 17.16 AC 8 — reframed writeable predicate.
      // Writeable iff:
      //   - doc has a draft in progress (current_draft_version_id != null), OR
      //   - doc is a never-approved DRAFT (no approved version exists yet)
      // Observationally equivalent to the legacy `status ∈ DRAFT/IN_REVIEW`
      // guard for all cases the existing 17.11/17.11b tests cover. Additionally
      // allows the "APPROVED with current_draft_version_id" dual-state — which
      // 17.11c will eventually exercise via auto-branch, but is not yet
      // reachable via any UI/agent path in this story.
      const writeable =
        document.current_draft_version_id != null ||
        (document.status === 'DRAFT' &&
          document.current_approved_version_id == null)
      if (!writeable) {
        return wrapToolError(
          'update_document',
          `Dokumentet kan inte ändras i status "${document.status}".`,
          'Endast utkast (DRAFT) eller dokument under granskning (IN_REVIEW) kan redigeras av agenten. Be användaren förgrena en ny redigerbar version av det godkända dokumentet först.',
          startTime
        )
      }

      // Story 17.16 AC 8: content source = draft pointer when set, else
      // approved pointer (never-approved DRAFT case). Never read the alias.
      const currentContent = (document.current_draft_version?.content_json ??
        document.current_approved_version?.content_json) as
        | TiptapDocumentJSON
        | null
        | undefined
      if (!currentContent || !Array.isArray(currentContent.content)) {
        return wrapToolError(
          'update_document',
          'Dokumentet saknar en aktuell version att redigera.',
          'Be användaren öppna och spara dokumentet en gång i editorn innan agenten föreslår ändringar.',
          startTime
        )
      }

      // AC 4: section_heading must exist (case-insensitive). Inform with a clear
      // message so the agent can re-issue with the correct heading text.
      if (!hasSection(currentContent, section_heading)) {
        return wrapToolError(
          'update_document',
          `Rubriken "${section_heading}" finns inte i dokumentet.`,
          'Använd den exakta rubriktexten som finns i dokumentet (matchas case-insensitivt). Läs dokumentet med get_workspace_document för att se rubrikerna.',
          startTime
        )
      }

      // Capture old section body (AC 2/3) via the same locator the dispatch will
      // use. extractSection cannot throw here — hasSection just confirmed it.
      const oldSectionContentJson = extractSection(
        currentContent,
        section_heading
      )

      // Normalize the agent's `updated_content` into TiptapNode[] (handles
      // bare array / doc-node / single-node shapes).
      const newSectionContentJson = normalizeBodyNodes(updated_content)
      if (newSectionContentJson === null) {
        return wrapToolError(
          'update_document',
          'Det nya innehållet är inte giltig Tiptap-JSON.',
          'Skicka en array av block-noder ([paragraph, heading, list, ...]) eller ett doc-node {type:"doc", content:[...]}.',
          startTime
        )
      }

      // AC 4 NTH-2: no-op-edit guard. Deep-equal via canonical JSON so a
      // cosmetic key-order shuffle doesn't sneak through. Surfaces a Swedish
      // error and creates NO pending row.
      if (
        canonicalJson(newSectionContentJson) ===
        canonicalJson(oldSectionContentJson)
      ) {
        return wrapToolError(
          'update_document',
          'Inga ändringar att föreslå.',
          'Det nya innehållet är identiskt med den nuvarande sektionen. Skicka ändrad text om en ändring är avsedd.',
          startTime
        )
      }

      const params = {
        documentId: document.id,
        // CP-001 (AC 6): renderer copy uses the document title as natural Swedish
        // (NOT an internal id). Captured at propose time and carried unchanged.
        documentTitle: document.title,
        sectionHeading: section_heading,
        oldSectionContentJson,
        newSectionContentJson,
        changeSummary: change_summary,
        // Story 14.31 staleness guard (Approved, blockers cleared) consumes this
        // ISO-8601 UTC snapshot at approve time — see lib/agent/tools/update-requirement.ts:188.
        entity_version: document.updated_at.toISOString(),
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'UPDATE_DOCUMENT',
        params
      )

      // Compact before→after preview line for the inline card / decision log.
      // Truncate aggressively so a long body doesn't bloat the meta payload.
      const oldPlain = tiptapToPlainText(oldSectionContentJson).slice(0, 80)
      const newPlain = tiptapToPlainText(newSectionContentJson).slice(0, 80)
      const preview =
        `Uppdatera "${section_heading}" i "${document.title}": ` +
        `${oldPlain || '(tom)'} → ${newPlain || '(tom)'}`

      const envelope = wrapWriteToolResponse(
        'update_document',
        'update_document',
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

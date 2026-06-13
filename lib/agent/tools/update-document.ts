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
  stripEmptyTextNodesFromList,
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
    .optional()
    .describe(
      'Rubriktext för den sektion som ska ersättas. Matchas case-insensitivt mot heading-noderna i dokumentet. Utelämnas om du bara byter dokumentets namn (new_title).'
    ),
  updated_content: z
    .any()
    .optional()
    .describe(
      'Tiptap-/ProseMirror-JSON för den nya sektionens BODY (det som kommer efter rubriken). Antingen en array av block-noder ([paragraph, ...]) eller ett doc-node {type:"doc", content:[...]}. Rubriken bevaras — skicka inte med rubriken igen. Krävs tillsammans med section_heading; utelämnas vid ren namnbyte.'
    ),
  new_title: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      'Nytt namn/titel för dokumentet. Använd när dokumentets titel ska bytas (t.ex. fel företagsnamn i rubriken). Kan kombineras med en sektionsändring eller skickas ensam.'
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
    description: `Föreslå en ÄNDRING av en specifik sektion i ett befintligt styrdokument (WorkspaceDocument) och/eller BYT NAMN på dokumentet.

Använd när användaren vill uppdatera en avsnittstext i ett dokument som redan finns — t.ex. "uppdatera Syfte-avsnittet" eller "skärp ansvarsdelen i policyn". Använd ALSO för att byta dokumentets titel/namn (\`new_title\`) — t.ex. när titeln nämner fel företag. En sektionsändring och ett namnbyte kan skickas tillsammans i samma förslag, eller var för sig (skicka bara \`new_title\` för ett rent namnbyte). För ett HELT NYTT dokument: använd istället \`draft_styrdokument\`.

Funkar mot DRAFT, IN_REVIEW samt APPROVED utan pågående utkast — i sista fallet skapas utkastet automatiskt när användaren godkänner förslaget (godkännandekortet visar "Skapar nytt utkast v{N+1}"). Upphävda eller arkiverade dokument kan inte ändras.

Skicka rubriken som ska redigeras i \`section_heading\` (matchas case-insensitivt) och den nya sektions-BODY:n i \`updated_content\` (Tiptap-JSON — antingen en array av block-noder eller ett doc-node). Rubriken bevaras automatiskt; skicka INTE med rubriken igen.

Detta skapar alltid ett förslag som användaren godkänner i chatten — ändringen sparas först efter godkännande. Läs dokumentets nuläge med get_workspace_document innan du föreslår.`,
    inputSchema: zodSchema(schema),
    execute: async ({
      document_id,
      section_heading,
      updated_content,
      new_title,
      change_summary,
    }: Input) => {
      const startTime = Date.now()

      // Story 26.x — update_document now also renames the document. An edit is a
      // SECTION edit (section_heading + updated_content) and/or a RENAME
      // (new_title); at least one must be present. Both can ride in one proposal
      // (e.g. fix a paragraph AND correct the title) — and on approval they
      // resolve to a single new version (no extra version for the rename).
      const hasSectionEdit =
        typeof section_heading === 'string' &&
        section_heading.length > 0 &&
        updated_content !== undefined
      const wantsRename =
        typeof new_title === 'string' && new_title.trim().length > 0
      if (!hasSectionEdit && !wantsRename) {
        return wrapToolError(
          'update_document',
          'Inget att ändra angavs.',
          'Ange antingen section_heading + updated_content för en sektionsändring, eller new_title för att byta dokumentets namn (eller båda).',
          startTime
        )
      }

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
          current_version_number: true,
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

      // Story 17.11c AC 3 — writeable predicate widens to also accept
      // APPROVED-with-no-draft. Three accepted shapes:
      //   - existing draft in progress (Row 2 from 17.11c decision matrix)
      //   - never-approved DRAFT (Row 1)
      //   - APPROVED with no draft (Row 3, new — triggers atomic auto-branch
      //     via createDraftFromApprovedWithEdit on approve)
      // SUPERSEDED / ARCHIVED stay non-writeable.
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
          'update_document',
          `Dokumentet kan inte ändras i status "${document.status}".`,
          'Endast utkast (DRAFT/IN_REVIEW) eller godkända dokument utan pågående utkast kan redigeras av agenten. Upphävda eller arkiverade dokument kan inte ändras.',
          startTime
        )
      }

      // Content source: draft pointer when set, else approved pointer (covers
      // both never-approved DRAFT AND the new auto-branch-eligible case where
      // the agent edits against the approved version's content directly).
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

      // Section-edit validation only runs when a section edit was requested. A
      // pure rename skips it entirely (no heading to locate, no body to diff).
      let oldSectionContentJson: ReturnType<typeof extractSection> | undefined
      let newSectionContentJson: TiptapNode[] | undefined
      if (hasSectionEdit) {
        const heading = section_heading as string

        // AC 4: section_heading must exist (case-insensitive). Inform with a clear
        // message so the agent can re-issue with the correct heading text.
        if (!hasSection(currentContent, heading)) {
          return wrapToolError(
            'update_document',
            `Rubriken "${heading}" finns inte i dokumentet.`,
            'Använd den exakta rubriktexten som finns i dokumentet (matchas case-insensitivt). Läs dokumentet med get_workspace_document för att se rubrikerna.',
            startTime
          )
        }

        // Capture old section body (AC 2/3) via the same locator the dispatch will
        // use. extractSection cannot throw here — hasSection just confirmed it.
        oldSectionContentJson = extractSection(currentContent, heading)

        // Normalize the agent's `updated_content` into TiptapNode[] (handles
        // bare array / doc-node / single-node shapes).
        const normalized = normalizeBodyNodes(updated_content)
        if (normalized === null) {
          return wrapToolError(
            'update_document',
            'Det nya innehållet är inte giltig Tiptap-JSON.',
            'Skicka en array av block-noder ([paragraph, heading, list, ...]) eller ett doc-node {type:"doc", content:[...]}.',
            startTime
          )
        }
        // Story 19.8 (QA): strip ProseMirror-invalid empty text nodes the model
        // emits for blank cells/paragraphs — otherwise the saved doc throws on
        // editor mount and renders blank.
        newSectionContentJson = stripEmptyTextNodesFromList(normalized)

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
      }

      // A rename is only effective when the proposed title actually differs from
      // the current one. A no-op rename with no section edit creates no proposal.
      const renameEffective =
        wantsRename && (new_title as string).trim() !== document.title
      if (!hasSectionEdit && !renameEffective) {
        return wrapToolError(
          'update_document',
          'Inga ändringar att föreslå.',
          'Det nya namnet är identiskt med dokumentets nuvarande namn. Skicka ett annat namn om ett byte är avsett.',
          startTime
        )
      }

      const params: Record<string, unknown> = {
        documentId: document.id,
        // CP-001 (AC 6): renderer copy uses the document title as natural Swedish
        // (NOT an internal id). Captured at propose time and carried unchanged.
        documentTitle: document.title,
        changeSummary: change_summary,
        // Story 14.31 staleness guard (Approved, blockers cleared) consumes this
        // ISO-8601 UTC snapshot at approve time — see lib/agent/tools/update-requirement.ts:188.
        entity_version: document.updated_at.toISOString(),
        // Story 17.11c AC 6: dispatch reads creates_draft to fork between plain
        // saveDocumentVersion (existing path) and createDraftFromApprovedWithEdit
        // (new atomic branch+write). Renderer reads creates_draft +
        // newVersionNumber to show the "Skapar nytt utkast v{N+1}" header.
        creates_draft: autoBranchEligible,
        newVersionNumber: document.current_version_number + 1,
      }
      if (hasSectionEdit) {
        params.sectionHeading = section_heading
        params.oldSectionContentJson = oldSectionContentJson
        params.newSectionContentJson = newSectionContentJson
      }
      if (renameEffective) {
        params.newTitle = (new_title as string).trim()
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'UPDATE_DOCUMENT',
        params
      )

      // Compact preview line for the inline card / decision log. Truncate
      // aggressively so a long body doesn't bloat the meta payload.
      let preview: string
      if (hasSectionEdit) {
        const oldPlain = tiptapToPlainText(
          (oldSectionContentJson ?? []) as TiptapNode[]
        ).slice(0, 80)
        const newPlain = tiptapToPlainText(
          (newSectionContentJson ?? []) as TiptapNode[]
        ).slice(0, 80)
        const section =
          `Uppdatera "${section_heading}" i "${document.title}": ` +
          `${oldPlain || '(tom)'} → ${newPlain || '(tom)'}`
        preview = renameEffective
          ? `${section} · Byt namn till "${(new_title as string).trim()}"`
          : section
      } else {
        preview = `Byt namn på "${document.title}" till "${(new_title as string).trim()}"`
      }

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

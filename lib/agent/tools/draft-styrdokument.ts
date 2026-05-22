/**
 * draft_styrdokument tool — propose a full agent-authored styrdokument (policy,
 * procedure, etc.) as a DRAFT_DOCUMENT PendingAgentAction. Story 14.24 (AC 4-6).
 *
 * Always proposes (no execute:true path — inline approval is the only finalize
 * route, per 14.23's pattern). On approve the dispatch creates a WorkspaceDocument
 * via createDocument (app/actions/documents.ts) and wires contextLinks.
 *
 * AC 3a content-quality gate: the Tiptap draft must have ≥3 top-level block nodes
 * AND ≥1 heading node, else the tool returns a ToolError and persists nothing.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

// Mirrors prisma `WorkspaceDocumentType`. Literal array (not z.nativeEnum) to
// match the existing tool pattern (create-task) and avoid zod-v4 nativeEnum drift.
const DOC_TYPES = [
  'POLICY',
  'RISK_ASSESSMENT',
  'ACTION_PLAN',
  'PROCEDURE',
  'INSTRUCTION',
  'CHECKLIST',
  'REPORT',
  'OTHER',
] as const

const schema = z.object({
  title: z.string().describe('Svensk titel på styrdokumentet'),
  docType: z
    .enum(DOC_TYPES)
    .describe(
      'Dokumenttyp: POLICY, PROCEDURE (rutin), RISK_ASSESSMENT (riskbedömning), ACTION_PLAN (handlingsplan), INSTRUCTION, CHECKLIST, REPORT eller OTHER'
    ),
  contentJson: z
    .any()
    .describe(
      'Tiptap-/ProseMirror-JSON för dokumentet: { "type": "doc", "content": [ ... ] }. Använd heading-noder för rubriker och paragraph-noder för stycken. Ett bra utkast har minst en rubrik och flera strukturerade stycken (syfte, ansvar, krav, motivering) och refererar relevant lagstiftning.'
    ),
  contextLinks: z
    .array(
      z.object({
        kind: z.enum(['TASK', 'LIST_ITEM']),
        id: z.string(),
      })
    )
    .optional()
    .describe(
      'Uppgifter (TASK) och/eller laglistposter (LIST_ITEM — en lag i bevakningslistan) som dokumentet ska kopplas till. Inkludera det chatten aktivt handlar om.'
    ),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignoreras — denna åtgärd kräver alltid inline-godkännande'),
})

type Input = z.infer<typeof schema>
type ContextLink = { kind: 'TASK' | 'LIST_ITEM'; id: string; title?: string }

/** Tiptap node shape (loose — only the fields we read). */
interface TiptapNode {
  type?: string
  text?: string
  content?: TiptapNode[]
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>
}

/** Recursively collect text from a Tiptap/ProseMirror node tree (Task 2.3 —
 * no reusable walker exists for the WorkspaceDocument Tiptap schema). */
function tiptapToPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as TiptapNode
  if (typeof n.text === 'string') return n.text
  if (Array.isArray(n.content)) {
    return n.content.map(tiptapToPlainText).join(' ')
  }
  return ''
}

/**
 * Normalize the model's `contentJson` into a Tiptap doc node. Models emit it in
 * three shapes — a proper doc node `{type:'doc',content:[...]}`, a bare blocks
 * array `[...]`, or (occasionally) a JSON string. Accept all three so a valid
 * draft isn't falsely rejected by the AC 3a gate. Returns null if unparseable.
 */
function normalizeTiptapDoc(input: unknown): TiptapNode | null {
  let cj: unknown = input
  if (typeof cj === 'string') {
    try {
      cj = JSON.parse(cj)
    } catch {
      return null
    }
  }
  if (Array.isArray(cj)) return { type: 'doc', content: cj as TiptapNode[] }
  if (cj && typeof cj === 'object') {
    const node = cj as TiptapNode
    if (Array.isArray(node.content)) {
      return node.type ? node : { type: 'doc', content: node.content }
    }
  }
  return null
}

/**
 * Drop a leading heading that just repeats the document title — the title is a
 * separate field the editor renders as the page heading, so a matching first
 * heading in the body shows the title twice. Conservative: exact (trimmed) match
 * on the first block only.
 */
function stripLeadingTitleHeading(doc: TiptapNode, title: string): TiptapNode {
  const blocks = doc.content ?? []
  const first = blocks[0]
  if (
    first?.type === 'heading' &&
    tiptapToPlainText(first).trim() === title.trim()
  ) {
    return { ...doc, content: blocks.slice(1) }
  }
  return doc
}

// QA (14.24, security): the draft is agent-authored and later rendered as HTML
// (DocumentDraftDetail preview + the created document). Strip link marks whose
// href uses a dangerous protocol so a prompt-injected link can't carry an XSS
// payload. Keeps the visible text, drops only the link mark.
const DANGEROUS_HREF = /^\s*(javascript|data|vbscript):/i
function sanitizeLinkHrefs(node: TiptapNode): TiptapNode {
  const out: TiptapNode = { ...node }
  if (Array.isArray(out.marks)) {
    out.marks = out.marks.filter(
      (m) =>
        m?.type !== 'link' || !DANGEROUS_HREF.test(String(m.attrs?.href ?? ''))
    )
  }
  if (Array.isArray(out.content)) {
    out.content = out.content.map(sanitizeLinkHrefs)
  }
  return out
}

/**
 * Validate a context link against the workspace and snapshot its display title.
 * Returns null when it doesn't resolve — so links the agent can't reliably source
 * (the global-chat case) are DROPPED rather than persisted as doomed links that
 * fail at approve time (QA 14.24). Workspace-scoped.
 */
async function resolveLink(
  workspaceId: string,
  link: { kind: 'TASK' | 'LIST_ITEM'; id: string }
): Promise<ContextLink | null> {
  if (link.kind === 'LIST_ITEM') {
    const item = await prisma.lawListItem.findFirst({
      where: { id: link.id, law_list: { workspace_id: workspaceId } },
      select: { document: { select: { title: true, document_number: true } } },
    })
    if (!item) return null
    const title =
      item.document?.title ?? item.document?.document_number ?? undefined
    return { kind: 'LIST_ITEM', id: link.id, ...(title ? { title } : {}) }
  }
  const task = await prisma.task.findFirst({
    where: { id: link.id, workspace_id: workspaceId },
    select: { title: true },
  })
  if (!task) return null
  return {
    kind: 'TASK',
    id: link.id,
    ...(task.title ? { title: task.title } : {}),
  }
}

export function createDraftStyrdokumentTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Författa ett komplett styrdokument (policy, rutin, riskbedömning m.m.) åt användaren.

Använd detta verktyg när användaren ber dig skriva ett dokument — t.ex. "skriv en policy för AFS 2023:5" eller "ta fram en rutin för systematiskt arbetsmiljöarbete". Generera ett välstrukturerat utkast i Tiptap-JSON med rubriker (heading) och stycken (paragraph): inkludera syfte, omfattning, ansvar, konkreta krav och motivering, och referera relevant lagstiftning samt företagets kontext.

Fyll i contextLinks med de uppgifter och laglistposter (lagar i bevakningslistan) som chatten handlar om så att dokumentet kopplas automatiskt vid godkännande.

Anropa verktyget direkt — det skapar ett inline-förslagskort i chatten där användaren förhandsgranskar, kan öppna i editorn och godkänner. Kortet är bekräftelsen: beskriv inte dokumentet i löpande text och fråga inte om lov först. Dokumentet skapas först när användaren godkänner.`,
    inputSchema: zodSchema(schema),
    execute: async ({ title, docType, contentJson, contextLinks }: Input) => {
      const startTime = Date.now()

      // Normalize the model's contentJson into a doc node (handles doc-node /
      // bare array / JSON-string shapes) before the quality gate + persistence.
      const doc = normalizeTiptapDoc(contentJson)
      const blocks: TiptapNode[] = doc?.content ?? []
      const hasHeading = blocks.some((n) => n?.type === 'heading')

      // AC 3a — content-quality gate: reject low-effort drafts before persisting.
      if (blocks.length < 3 || !hasHeading) {
        console.error('[draft_styrdokument] rejected by quality gate', {
          contentJsonType: typeof contentJson,
          isArray: Array.isArray(contentJson),
          topLevelType: (contentJson as TiptapNode | null)?.type,
          blockCount: blocks.length,
          hasHeading,
        })
        return wrapToolError(
          'draft_styrdokument',
          'Utkastet är för kortfattat.',
          'Utkastet är för kortfattat. Inkludera minst en rubrik och tre stycken så det blir användbart för användaren.',
          startTime
        )
      }

      // Gate on the full doc above (title heading counts), but persist a version
      // with the redundant leading title-heading stripped (title is a separate
      // field) and dangerous link hrefs sanitized (agent-authored → rendered as HTML).
      const persistedDoc = sanitizeLinkHrefs(
        stripLeadingTitleHeading(doc!, title)
      )

      // Build contextLinks from two sources, BOTH validated against the workspace
      // (drop ids that don't resolve — the agent can't reliably source them, and a
      // doomed link would just fail at approve) and title-snapshotted for the chip:
      //  1) agent-supplied links, then
      //  2) the chat's own context (contextId = a LawListItem.id in LAW chats /
      //     Task.id in TASK chats — not visible to the model, so auto-derived here).
      const links: ContextLink[] = []
      for (const l of contextLinks ?? []) {
        if (links.some((x) => x.kind === l.kind && x.id === l.id)) continue
        const resolved = await resolveLink(workspaceId, l)
        if (resolved) links.push(resolved)
      }
      if (context?.contextId) {
        const cid = context.contextId
        const ctxKind =
          context.contextType === 'LAW'
            ? ('LIST_ITEM' as const)
            : context.contextType === 'TASK'
              ? ('TASK' as const)
              : null
        if (ctxKind && !links.some((x) => x.kind === ctxKind && x.id === cid)) {
          const resolved = await resolveLink(workspaceId, {
            kind: ctxKind,
            id: cid,
          })
          if (resolved) links.push(resolved)
        }
      }

      const params = {
        title,
        docType,
        // Persist the NORMALIZED + de-duplicated doc so the preview/editor/document
        // all get a consistent shape without the doubled title.
        contentJson: persistedDoc,
        contextLinks: links,
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'DRAFT_DOCUMENT',
        params
      )

      const plain = tiptapToPlainText(persistedDoc).trim().slice(0, 200)
      const envelope = wrapWriteToolResponse(
        'draft_styrdokument',
        'draft_styrdokument',
        params,
        `Utkast styrdokument: "${title}"${plain ? ` — ${plain}` : ''}`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}

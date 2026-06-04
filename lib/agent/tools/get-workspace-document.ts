/**
 * get_workspace_document tool — Story 17.10 + extended by Story 17.18 AC 5.
 *
 * **17.10 model:** read the full content + metadata of a single authored
 * styrdokument by id, converting `content_html` via `htmlToMarkdown(...)`.
 * Workspace-scoped (AC 11). Truncation at ~20,000 chars (AC 10).
 *
 * **17.18 AC 5 — dual response shape:** under Story 17.16's dual-pointer
 * schema, a doc can carry approved + draft content snapshots simultaneously.
 * The response shape now includes `approved` and `draft` nested objects plus
 * a top-level `dualState` flag:
 *
 *  - `approved`: `{ versionNumber, content, contentHtml, approvedAt, approvedByName, citationKey }`
 *    or `null` when no approved version exists (never-approved drafts).
 *  - `draft`: `{ versionNumber, content, contentHtml, draftStatus, createdAt, citationKey }`
 *    or `null` when no draft is in progress.
 *  - `dualState`: `true` when both pointers set.
 *
 * **Backward-compatible top-level fields:** `content` + `contentHtml` stay
 * populated with the EFFECTIVE version (approved when present, else draft)
 * so any caller unaware of the new shape continues to get the right answer
 * by default. SF-2: `citationKey` per tier uses `draft.version_number`
 * directly (NOT approved+1) — same as `search_workspace_documents`.
 *
 * Content source: converts from `content_html` via `htmlToMarkdown` (Story
 * 17.10 AC 9 / C3). NOT `extracted_text`.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import { wrapToolResponse, wrapToolError, truncateMarkdown } from './utils'

const getWorkspaceDocumentSchema = z.object({
  document_id: z
    .string()
    .describe(
      'UUID för styrdokumentet (kommer från search_workspace_documents eller list_workspace_documents).'
    ),
})

type GetWorkspaceDocumentInput = z.infer<typeof getWorkspaceDocumentSchema>

// AC 10 says "first 20,000 chars". `truncateMarkdown` is keyed on token count
// (chars ÷ 4), so 5000 tokens ≈ 20,000 chars at its paragraph-boundary cut.
const CONTENT_TOKEN_LIMIT = 5000
const CONTENT_CHAR_LIMIT = CONTENT_TOKEN_LIMIT * 4 // 20,000

/**
 * Convert content_html → markdown → optionally-truncated string with an AC 10
 * truncation hint appended in Swedish. Shared by both tiers in the dual shape.
 */
function buildTierContent(contentHtml: string | null | undefined): {
  content: string
  contentHtml: string
  totalChars: number
  truncated: boolean
} {
  const html = contentHtml ?? ''
  const rawMarkdown = html ? htmlToMarkdown(html) : ''
  const totalChars = rawMarkdown.length
  const content = truncateMarkdown(rawMarkdown, CONTENT_TOKEN_LIMIT)
  const truncated = totalChars > content.length
  return {
    content: truncated
      ? `${content}\n\n[Trunkerat — dokumentet har ${totalChars} tecken totalt]`
      : content,
    contentHtml: html,
    totalChars,
    truncated,
  }
}

export function createGetWorkspaceDocumentTool(workspaceId: string) {
  return tool({
    description: `Läs hela innehållet och metadatan för ett specifikt styrdokument (policy, rutin, riskbedömning etc.) i arbetsytan.

Använd när du behöver hela texten för ett styrdokument — t.ex. efter att ha hittat det via search_workspace_documents, eller när användaren refererar till ett specifikt dokument.

Returnerar titel, dokumenttyp, status, nuvarande version, dokumentnummer, hela innehållet (markdown, konverterat från Tiptap-källan), granskningsdatum, godkännare och godkänningsdatum, samt länkade uppgifter och länkade laglistposter. Innehållet trunkeras vid ${CONTENT_CHAR_LIMIT} tecken; det totala antalet tecken redovisas så du kan be användaren begränsa frågan om dokumentet är mycket långt.

**Story 17.18 — dubbeltillstånd:** dokument med BÅDE en godkänd version OCH ett pågående utkast (\`dualState: true\`) returneras med separata \`approved\`- och \`draft\`-objekt. Citera \`approved.citationKey\` (formen "<titel>") som den auktoritativa källan med [Källa: ...] och nämn utkastet med \`draft.citationKey\` (formen "<titel> (utkast v<N>)") och [Utkast: ...] endast om det materiellt påverkar svaret. För dokument med bara en pekare populeras endast den ena nestade tier-en — och toppnivåfälten \`content\`/\`contentHtml\` speglar den effektiva versionen (godkänd när den finns, annars utkast) för bakåtkompatibilitet.

Returnerar ett "hittades inte"-fel om dokumentet inte tillhör den aktiva arbetsytan eller inte finns.`,
    inputSchema: zodSchema(getWorkspaceDocumentSchema),
    execute: async ({ document_id }: GetWorkspaceDocumentInput) => {
      const startTime = Date.now()

      try {
        const doc = await prisma.workspaceDocument.findFirst({
          where: { id: document_id, workspace_id: workspaceId },
          select: {
            id: true,
            title: true,
            document_type: true,
            status: true,
            document_number: true,
            review_date: true,
            approved_at: true,
            current_version_number: true,
            approver: { select: { name: true } },
            // Story 17.18 AC 5: dual-pointer reads + draft sub-status.
            current_approved_version_id: true,
            current_draft_version_id: true,
            draft_status: true,
            current_approved_version: {
              select: {
                content_html: true,
                version_number: true,
                approved_at: true,
              },
            },
            current_draft_version: {
              select: {
                content_html: true,
                version_number: true,
                created_at: true,
              },
            },
            // Legacy alias for backward-compat fallback when both pointers
            // null (defensive — should not be reachable post-17.16 backfill).
            current_version: {
              select: { content_html: true, version_number: true },
            },
            task_links: {
              select: {
                task: { select: { id: true, title: true } },
              },
            },
            list_item_links: {
              select: {
                list_item: {
                  select: {
                    id: true,
                    document: {
                      select: { title: true, document_number: true },
                    },
                  },
                },
              },
            },
          },
        })

        if (!doc) {
          return wrapToolError(
            'get_workspace_document',
            'Styrdokumentet hittades inte.',
            'Kontrollera att document_id är korrekt och att dokumentet tillhör den aktiva arbetsytan. Använd search_workspace_documents eller list_workspace_documents för att hitta rätt id.',
            startTime
          )
        }

        // ── Build approved tier object (or null) ──────────────────────────
        const approved = doc.current_approved_version
          ? (() => {
              const { content, contentHtml } = buildTierContent(
                doc.current_approved_version.content_html
              )
              return {
                versionNumber: doc.current_approved_version.version_number,
                content,
                contentHtml,
                approvedAt: doc.current_approved_version.approved_at,
                approvedByName: doc.approver?.name ?? null,
                // SF-2: approved tier keeps the clean title as citationKey.
                citationKey: doc.title,
              }
            })()
          : null

        // ── Build draft tier object (or null) ─────────────────────────────
        const draft = doc.current_draft_version
          ? (() => {
              const { content, contentHtml } = buildTierContent(
                doc.current_draft_version.content_html
              )
              return {
                versionNumber: doc.current_draft_version.version_number,
                content,
                contentHtml,
                draftStatus: doc.draft_status,
                createdAt: doc.current_draft_version.created_at,
                // SF-2: draft tier embeds the draft's actual version_number.
                citationKey: `${doc.title} (utkast v${doc.current_draft_version.version_number})`,
              }
            })()
          : null

        const dualState =
          doc.current_approved_version_id != null &&
          doc.current_draft_version_id != null

        // ── Backward-compatible top-level content (approved → draft → alias)
        // Callers unaware of the new shape still get the EFFECTIVE content
        // (approved when present, else draft, else the deprecated alias as
        // the final defensive fallback).
        const effectiveTier = approved ?? draft
        const legacyAlias = doc.current_version?.content_html
          ? buildTierContent(doc.current_version.content_html)
          : null
        const topLevelContent =
          effectiveTier?.content ?? legacyAlias?.content ?? ''
        const topLevelContentHtml =
          effectiveTier?.contentHtml ?? legacyAlias?.contentHtml ?? ''

        const result = {
          documentId: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          status: doc.status,
          documentNumber: doc.document_number,
          currentVersionNumber: doc.current_version_number,
          reviewDate: doc.review_date,
          approvedBy: doc.approver?.name ?? null,
          approvedAt: doc.approved_at,
          // Story 17.18 AC 5: dual response shape.
          approved,
          draft,
          dualState,
          // Story 17.18 AC 5 backward-compat: top-level fields point at the
          // effective version's content. Pre-17.18 callers get the right
          // answer without any awareness of the dual shape.
          content: topLevelContent,
          contentHtml: topLevelContentHtml,
          linkedTasks: doc.task_links.map((l) => ({
            id: l.task.id,
            title: l.task.title,
          })),
          linkedLawListItems: doc.list_item_links.map((l) => ({
            id: l.list_item.id,
            lawTitle: l.list_item.document.title,
            documentNumber: l.list_item.document.document_number,
          })),
        }

        return wrapToolResponse('get_workspace_document', result, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'get_workspace_document',
          `Kunde inte hämta styrdokumentet: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

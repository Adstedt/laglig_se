/**
 * transition_document_status tool — Story 14.30: propose a styrdokument status
 * transition on the WorkspaceDocumentStatus ladder
 * (`DRAFT → IN_REVIEW → APPROVED → SUPERSEDED → ARCHIVED`, Story 17.4).
 *
 * Always proposes a PendingAgentAction of type TRANSITION_DOCUMENT_STATUS
 * (inline approval only — no `execute: true` direct write). On approve, the
 * dispatch calls the existing `updateDocumentStatus` server action
 * (`app/actions/documents.ts:351`).
 *
 * **Separation of duties (AC 4 + AC 13):** the agent NEVER proposes
 * `newStatus: 'APPROVED'`. Approval is a deliberate human act and is gated at
 * TWO layers — this tool refuses it up front (first line, better agent UX),
 * and the dispatch refuses it again as the authoritative trusted gate. The
 * ladder permits `IN_REVIEW → APPROVED` (`lib/validation/documents.ts:63`),
 * so the ladder check alone would NOT block self-approval — this dedicated
 * APPROVED guard is the load-bearing protection.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import type { WorkspaceDocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'
// AC 2.2 sourcing note: import the ladder from `lib/validation/documents.ts`
// (the canonical source), NOT from `app/actions/documents.ts` — that file
// only re-imports it.
import { VALID_STATUS_TRANSITIONS } from '@/lib/validation/documents'
// AC 10 / context-assembly summary: resolve raw enum → Swedish label at
// propose-time and stamp it into params (mirrors UPDATE_COMPLIANCE_STATUS).
// The renderer's DocumentStatusBadge does its own label lookup; this is for
// the summary text on the lead line + the pending-actions context block.
import { STATUS_CONFIG } from '@/components/features/documents/document-status-badge'

const transitionDocumentStatusSchema = z.object({
  documentId: z
    .string()
    .uuid()
    .describe('ID på styrdokumentet som statusen ska ändras för.'),
  newStatus: z
    .enum(['DRAFT', 'IN_REVIEW', 'SUPERSEDED', 'ARCHIVED'])
    .describe(
      'Nytt statusvärde. APPROVED är INTE tillåtet här — godkännande av styrdokument görs alltid manuellt av en behörig användare (åtskillnad av ansvar). Använd för att skicka utkast till granskning (DRAFT → IN_REVIEW), skicka tillbaka till utkast, ersätta eller arkivera.'
    ),
  comment: z
    .string()
    .max(2000)
    .optional()
    .describe(
      'Valfri notis som beskriver varför statusen ska ändras (loggas på dokumentet).'
    ),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type TransitionDocumentStatusInput = z.infer<
  typeof transitionDocumentStatusSchema
>

export function createTransitionDocumentStatusTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Föreslå en statusövergång för ett styrdokument (Utkast → Under granskning, tillbaka till Utkast, Ersatt, eller Arkiverad).

Använd när användaren signalerar att ett utkast är redo för granskning, att en godkänd policy är obsolet och bör ersättas/arkiveras, eller att ett dokument ska skickas tillbaka för revidering.

**Du får ALDRIG föreslå \`newStatus: 'APPROVED'\`** — godkännande är ett manuellt mänskligt beslut som görs i styrdokumentets gränssnitt (åtskillnad av ansvar). Om användaren ber dig "godkänna" ett dokument, förklara att du inte kan göra det själv — de måste klicka godkänn i editorn.

Detta skapar alltid ett förslag som användaren godkänner i chatten — statusändringen träder i kraft först efter godkännande. Kortet är bekräftelsen: beskriv inte ändringen i löpande svar och fråga inte om lov först.

Returnerar fel om: dokumentet inte tillhör den aktiva arbetsytan, övergången inte är giltig enligt status-trappan (\`VALID_STATUS_TRANSITIONS\`), eller om \`newStatus = APPROVED\` (separation-of-duties).`,
    inputSchema: zodSchema(transitionDocumentStatusSchema),
    execute: async ({
      documentId,
      newStatus,
      comment,
      execute,
    }: TransitionDocumentStatusInput) => {
      const startTime = Date.now()

      // Inline approval is the only finalization path (mirrors 14.23 / 14.28 / 14.29).
      if (execute) {
        return wrapToolError(
          'transition_document_status',
          'Den här åtgärden kan inte köras direkt.',
          'Statusövergångar bekräftas alltid via godkännandekortet i chatten — anropa utan execute.',
          startTime
        )
      }

      // AC 4 — Separation-of-duties guard (tool level, first line).
      // The Zod enum above already excludes 'APPROVED', so this is a
      // belt-and-suspenders runtime check covering any direct-execute path
      // that might bypass schema parsing. The dispatch enforces the same
      // guard authoritatively (AC 13).
      if ((newStatus as WorkspaceDocumentStatus) === 'APPROVED') {
        return wrapToolError(
          'transition_document_status',
          'Agenten kan inte godkänna styrdokument — godkännande måste göras manuellt av en behörig användare.',
          'Föreslå istället en annan övergång (t.ex. DRAFT → IN_REVIEW) och be användaren godkänna manuellt i editorn när dokumentet är redo.',
          startTime
        )
      }

      // Workspace-scoped doc lookup — captures the current status (for AC 5
      // ladder validation), the title (denormalised for the renderer per
      // AC 10), and updated_at (entity_version for forward-compat with 14.31)
      // in one query.
      const doc = await prisma.workspaceDocument.findFirst({
        where: { id: documentId, workspace_id: workspaceId },
        select: { id: true, title: true, status: true, updated_at: true },
      })
      if (!doc) {
        return wrapToolError(
          'transition_document_status',
          'Styrdokumentet hittades inte.',
          'Kontrollera att documentId är korrekt och att dokumentet tillhör den aktiva arbetsytan.',
          startTime
        )
      }

      // AC 5 — Ladder validity. The dedicated APPROVED guard above is
      // load-bearing because the ladder permits IN_REVIEW → APPROVED — do NOT
      // remove that guard thinking this check covers it.
      const allowed = VALID_STATUS_TRANSITIONS[doc.status]
      if (!allowed.includes(newStatus as WorkspaceDocumentStatus)) {
        return wrapToolError(
          'transition_document_status',
          `Ogiltig statusövergång: ${doc.status} → ${newStatus}.`,
          `Från ${doc.status} är dessa övergångar tillåtna: ${allowed.length > 0 ? allowed.join(', ') : '(inga — ARCHIVED är terminal)'}.`,
          startTime
        )
      }

      const oldLabel = STATUS_CONFIG[doc.status].label
      const newLabel = STATUS_CONFIG[newStatus as WorkspaceDocumentStatus].label

      const params = {
        documentId: doc.id,
        documentTitle: doc.title,
        oldStatus: doc.status,
        newStatus,
        oldStatusLabel: oldLabel,
        newStatusLabel: newLabel,
        ...(comment !== undefined && { comment }),
        // Forward-compat with Story 14.31 (staleness guard).
        entity_version: doc.updated_at.toISOString(),
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'TRANSITION_DOCUMENT_STATUS',
        params
      )

      const envelope = wrapWriteToolResponse(
        'transition_document_status',
        'transition_document_status',
        params,
        `Status för "${doc.title}": ${oldLabel} → ${newLabel}`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}

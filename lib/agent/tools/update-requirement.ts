/**
 * update_requirement tool — Story 14.28: propose an edit to a kravpunkt
 * (LawListItemRequirement).
 *
 * Always proposes a PendingAgentAction of type UPDATE_REQUIREMENT (inline
 * approval only — no `execute: true` direct write). The renderer shows a
 * field-by-field old→new diff; on approve, dispatch calls the existing
 * `updateRequirement` server action (Story 17.16). Scope = the four compliance
 * fields (text / is_fulfilled / comment / bevis_required); ownership reassignment
 * is intentionally out of scope.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { wrapWriteToolResponse, wrapToolError } from './utils'
import {
  createPendingActionRow,
  type PendingActionToolContext,
} from './pending-action'

const schema = z.object({
  requirementId: z
    .string()
    .uuid()
    .describe('ID för kravpunkten (LawListItemRequirement) som ska ändras.'),
  text: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe('Ny kravpunktstext (max 500 tecken).'),
  isFulfilled: z
    .boolean()
    .optional()
    .describe(
      'Markera kravpunkten som uppfylld (true) eller ej uppfylld (false).'
    ),
  comment: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe('Kommentar/notis på kravpunkten. null rensar kommentaren.'),
  bevisRequired: z
    .boolean()
    .optional()
    .describe('Om kravpunkten kräver kopplat bevis ("bevis krävs").'),
  execute: z
    .boolean()
    .optional()
    .default(false)
    .describe('Ignored — this action always requires inline approval'),
})

type Input = z.infer<typeof schema>

const norm = (v: string | null | undefined): string => (v ?? '').trim()

export function createUpdateRequirementTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Föreslå en ändring av en kravpunkt (LawListItemRequirement) på en lag i bevakningslistan.

Använd när användaren vill: markera en kravpunkt som uppfylld/ej uppfylld (\`isFulfilled\`), skärpa eller omformulera kravtexten (\`text\`), sätta/rensa en kommentar (\`comment\`, \`null\` rensar), eller slå på/av "bevis krävs" (\`bevisRequired\`).

Ange ENDAST de fält som ska ändras. Använd INTE detta för att byta ansvarig (det är en separat tilldelning). Föreslå inte en ändring där värdet redan är satt (no-op).

Detta skapar alltid ett förslag som användaren godkänner i chatten — ändringen sparas först efter godkännande. Läs kravpunktens nuläge med get_law_list_item innan du föreslår.`,
    inputSchema: zodSchema(schema),
    execute: async ({
      requirementId,
      text,
      isFulfilled,
      comment,
      bevisRequired,
      execute,
    }: Input) => {
      const startTime = Date.now()

      // Inline approval is the only finalization path (mirrors the 14.23 pattern).
      if (execute) {
        return wrapToolError(
          'update_requirement',
          'Den här åtgärden kan inte köras direkt.',
          'Kravpunktsändringar bekräftas alltid via godkännandekortet i chatten — anropa utan execute.',
          startTime
        )
      }

      // At least one mutable field must be supplied (Swedish message rather than
      // a raw schema error).
      if (
        text === undefined &&
        isFulfilled === undefined &&
        comment === undefined &&
        bevisRequired === undefined
      ) {
        return wrapToolError(
          'update_requirement',
          'Ingen ändring angiven.',
          'Ange minst ett fält att ändra (text, uppfylld, kommentar eller bevis krävs).',
          startTime
        )
      }

      // Workspace-scoped read: scopes ownership (via the where) AND snapshots the
      // old values + updated_at in one query.
      const existing = await prisma.lawListItemRequirement.findFirst({
        where: {
          id: requirementId,
          list_item: { law_list: { workspace_id: workspaceId } },
        },
        select: {
          text: true,
          is_fulfilled: true,
          bevis_required: true,
          comment: true,
          updated_at: true,
          list_item_id: true,
        },
      })
      if (!existing) {
        return wrapToolError(
          'update_requirement',
          'Kravpunkten hittades inte.',
          'Kontrollera att ID:t är korrekt och att kravpunkten tillhör arbetsytan.',
          startTime
        )
      }

      const oldSnapshot = {
        text: existing.text,
        isFulfilled: existing.is_fulfilled,
        comment: existing.comment,
        bevisRequired: existing.bevis_required,
      }

      // Build the patch from CHANGED fields only (whitespace-insensitive for the
      // text fields per AC 9) — so the diff renderer + the no-op guard are exact.
      const patch: {
        text?: string
        isFulfilled?: boolean
        comment?: string | null
        bevisRequired?: boolean
      } = {}
      if (text !== undefined && norm(text) !== norm(oldSnapshot.text)) {
        patch.text = text
      }
      if (
        isFulfilled !== undefined &&
        isFulfilled !== oldSnapshot.isFulfilled
      ) {
        patch.isFulfilled = isFulfilled
      }
      if (
        bevisRequired !== undefined &&
        bevisRequired !== oldSnapshot.bevisRequired
      ) {
        patch.bevisRequired = bevisRequired
      }
      if (
        comment !== undefined &&
        norm(comment) !== norm(oldSnapshot.comment)
      ) {
        patch.comment = comment
      }

      if (Object.keys(patch).length === 0) {
        return wrapToolError(
          'update_requirement',
          'Ingen faktisk ändring — värdena är redan satta.',
          'Kontrollera nuläget med get_law_list_item innan du föreslår en ändring.',
          startTime
        )
      }

      const params = {
        requirementId,
        // For the renderer's list-item link + the post-approve live SWR refresh
        // of the kravpunkter panel (agent-action-card affectedSwrKeys).
        lawListItemId: existing.list_item_id,
        patch,
        oldSnapshot,
        // Forward-compat with Story 14.31 (staleness guard) — carried unchanged.
        entity_version: existing.updated_at.toISOString(),
      }

      const pendingActionId = await createPendingActionRow(
        workspaceId,
        context,
        'UPDATE_REQUIREMENT',
        params
      )

      const n = Object.keys(patch).length
      const envelope = wrapWriteToolResponse(
        'update_requirement',
        'update_requirement',
        params,
        `Ändra kravpunkt (${n} ${n === 1 ? 'fält' : 'fält'})`,
        startTime
      )
      return pendingActionId
        ? { ...envelope, data: { pendingActionId } }
        : envelope
    },
  })
}

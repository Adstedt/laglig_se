/**
 * list_unassessed_changes tool — Story 19.3 (diagnostics).
 *
 * Workspace-wide read: detected lagändringar on the workspace's tracked laws
 * that have no ChangeAssessment yet (and post-date the item's acknowledgement
 * floor). Delegates to the SF-A `loadUnacknowledgedChanges(workspaceId)` core
 * (closure workspaceId — no session/cookies() dependency in the streaming loop).
 *
 * Count semantics: one row per (ChangeEvent × LawList) — same as the Changes tab
 * (a law tracked in two lists = two work items). Frame as "obedömda ändringar att
 * hantera" (work items), NOT "N distinct lagändringar".
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { loadUnacknowledgedChanges } from '@/app/actions/change-events'
import { wrapToolResponse, wrapToolError } from './utils'
import { shortText, priorityLabel, changeTypeLabel } from './reader-utils'

const schema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max antal poster att visa (standard 20).'),
})

type Input = z.infer<typeof schema>

export function createListUnassessedChangesTool(workspaceId: string) {
  return tool({
    description: `Lista obedömda lagändringar (arbetsposter att hantera) på arbetsytans bevakade lagar — ändringar som ännu saknar en bedömning. Använd för "vad har vi inte bedömt än?" / "vad bör vi prioritera?". Antalet räknas per (ändring × laglista), dvs samma lag i två listor blir två poster — beskriv det som "obedömda ändringar att hantera", inte som antal unika lagändringar. Varje post har \`lawListItemId\` + \`changeEventId\` (följ upp med get_law_list_item / get_change_details). Tomt resultat (count 0) = allt bevakat är bedömt; rapportera positivt.`,
    inputSchema: zodSchema(schema),
    execute: async ({ limit }: Input) => {
      const startTime = Date.now()
      const take = limit ?? 20

      try {
        // SF-A: closure workspaceId — no session dependency in the tool loop.
        const result = await loadUnacknowledgedChanges(workspaceId)
        if (!result.success || !result.data) {
          return wrapToolError(
            'list_unassessed_changes',
            result.error ?? 'Kunde inte hämta obedömda ändringar.',
            'Ett tekniskt fel uppstod. Försök igen om en stund.',
            startTime
          )
        }

        const all = result.data
        const count = all.length // true total; set is naturally bounded
        const changes = all.slice(0, take).map((c) => ({
          changeEventId: c.id,
          lawListItemId: c.lawListItemId,
          lawName: c.documentTitle,
          sfsNumber: c.documentNumber || null,
          changeType: changeTypeLabel(c.changeType) ?? c.changeType,
          amendmentSfs: c.amendmentSfs,
          summary: shortText(c.aiSummary, 80),
          detectedAt: c.detectedAt.toISOString(),
          priority: priorityLabel(c.priority) ?? c.priority,
        }))

        return wrapToolResponse(
          'list_unassessed_changes',
          { count, changes },
          startTime,
          count
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_unassessed_changes',
          `Kunde inte hämta obedömda ändringar: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

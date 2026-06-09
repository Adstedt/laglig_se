/**
 * list_linked_artifacts tool — Story 19.4.
 *
 * Lists every file/styrdokument linked to a LawListItem (direct, via kravpunkt
 * bevis, or via linked tasks) by delegating to `loadLinkedArtifacts` — the
 * workspaceId-parameterized core (SF-A) — with the tool's CLOSURE workspaceId,
 * so there is no session/`cookies()` dependency inside the streaming tool loop.
 *
 * For `file`-kind artifacts, `id` IS the WorkspaceFile id → pass it to read_file.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { loadLinkedArtifacts } from '@/app/actions/linked-artifacts'
import { wrapToolResponse, wrapToolError } from './utils'
import type { PendingActionToolContext } from './pending-action'

const schema = z.object({
  lawListItemId: z
    .string()
    .optional()
    .describe(
      'ID för laglistposten. Utelämna i en lag-chatt — då används den aktiva posten.'
    ),
})

type Input = z.infer<typeof schema>

export function createListLinkedArtifactsTool(
  workspaceId: string,
  context?: PendingActionToolContext
) {
  return tool({
    description: `Lista alla filer och styrdokument som är kopplade till en laglistpost — direkt, via bevis på kravpunkter, eller via kopplade uppgifter.

Varje artefakt har: \`kind\` (file|document), \`id\`, \`name\`, \`directLink\` (true = direktlänkad till posten), och vilka \`requirements\`/\`tasks\` den hör till. **För \`file\`-artefakter är \`id\` det fileId du kan läsa i sin helhet med read_file.**

Utelämna \`lawListItemId\` i en lag-chatt (den aktiva posten används); i en global chatt: hitta posten först med search_law_list_items.`,
    inputSchema: zodSchema(schema),
    execute: async ({ lawListItemId }: Input) => {
      const startTime = Date.now()

      const resolvedId = lawListItemId ?? context?.lawListItemId
      if (!resolvedId) {
        return wrapToolError(
          'list_linked_artifacts',
          'Ingen laglistpost angiven.',
          'Ange lawListItemId, eller använd search_law_list_items för att hitta rätt post.',
          startTime
        )
      }

      try {
        // SF-A: closure workspaceId — no session dependency in the tool loop.
        const result = await loadLinkedArtifacts(resolvedId, workspaceId)
        if (!result.success || !result.data) {
          return wrapToolError(
            'list_linked_artifacts',
            result.error ?? 'Kunde inte hämta länkade artefakter.',
            'Kontrollera att laglistposten finns i arbetsytan.',
            startTime
          )
        }

        const artifacts = result.data.artifacts.map((a) => ({
          kind: a.kind,
          id: a.id, // file-kind: this is the fileId for read_file
          name:
            a.kind === 'file'
              ? (a.filename ?? 'okänd fil')
              : (a.title ?? 'okänt dokument'),
          directLink: a.directLink,
          requirements: a.requirements,
          tasks: a.tasks,
        }))

        return wrapToolResponse(
          'list_linked_artifacts',
          {
            artifacts,
            tasksWithoutAttachmentCount:
              result.data.tasksWithoutAttachmentCount,
          },
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_linked_artifacts',
          `Kunde inte hämta länkade artefakter: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

/**
 * list_bevis_gaps tool — Story 19.3 (diagnostics).
 *
 * Workspace-wide read: kravpunkter that REQUIRE bevis but have none
 * (`bevis_required && evidence_links none`). Reuses the canonical `needs_evidence`
 * definition (mirrors `buildRequirementWhere` at `lib/requirements/query-builders.ts`).
 * Returns the true `count` (separate query) + a capped list of gaps, each carrying
 * `lawListItemId` so the agent can drill in via get_law_list_item.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import { shortText, userNameOrNull } from './reader-utils'

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

export function createListBevisGapsTool(workspaceId: string) {
  return tool({
    description: `Lista kravpunkter i hela arbetsytan som kräver bevis men saknar det (bevisluckor). Använd för "var saknar vi bevis?" / "vad bör vi prioritera?". Returnerar totalt antal + de översta posterna med \`lawListItemId\` (följ upp med get_law_list_item). Ett tomt resultat (count 0) är goda nyheter — rapportera positivt.`,
    inputSchema: zodSchema(schema),
    execute: async ({ limit }: Input) => {
      const startTime = Date.now()
      const take = limit ?? 20

      try {
        // Canonical "needs evidence" definition (parity with
        // buildRequirementWhere('needs_evidence'), query-builders.ts:67).
        const where: Prisma.LawListItemRequirementWhereInput = {
          list_item: { law_list: { workspace_id: workspaceId } },
          bevis_required: true,
          evidence_links: { none: {} },
        }

        const [count, rows] = await Promise.all([
          prisma.lawListItemRequirement.count({ where }),
          prisma.lawListItemRequirement.findMany({
            where,
            take,
            orderBy: { created_at: 'desc' },
            select: {
              id: true,
              text: true,
              responsible_user: { select: { name: true, email: true } },
              list_item: {
                select: {
                  id: true,
                  responsible_user: { select: { name: true, email: true } },
                  document: {
                    select: { title: true, document_number: true },
                  },
                },
              },
            },
          }),
        ])

        const gaps = rows.map((r) => ({
          requirementId: r.id,
          text: shortText(r.text, 60) ?? '',
          lawListItemId: r.list_item.id,
          lawName:
            r.list_item.document?.title ??
            r.list_item.document?.document_number ??
            'Okänd lag',
          sfsNumber: r.list_item.document?.document_number ?? null,
          // Names, not raw user ids: krav-level responsible, else parent item's.
          responsibleName:
            userNameOrNull(r.responsible_user) ??
            userNameOrNull(r.list_item.responsible_user),
        }))

        return wrapToolResponse(
          'list_bevis_gaps',
          { count, gaps },
          startTime,
          count
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'list_bevis_gaps',
          `Kunde inte hämta bevisluckor: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

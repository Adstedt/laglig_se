/**
 * search_collective_agreements tool — semantic search across the workspace's
 * kollektivavtal (COLLECTIVE_AGREEMENT chunks). Story 7.7 (AC 3, 4).
 *
 * Mirrors `search-workspace-files.ts` (same `tool()` shape, wrapToolResponse/
 * wrapToolError, startTime telemetry). One sourceType per tool — this NEVER
 * widens `search_laws` and never queries LEGAL_DOCUMENT.
 *
 * Assigned-agreement bias (AC 4) — precedence:
 *   1. model-supplied `agreementId` input param (e.g. from a lookup_employee
 *      result) — overrides everything;
 *   2. `biasAgreementId` closure default (the pill-selected employee's
 *      assigned agreement, resolved server-side in the chat route);
 *   3. none → all workspace agreements.
 * The filter is a HARD `source_id` filter in retrieval. Safe by construction:
 * the workspace clause sits underneath, so a foreign/hallucinated id filters
 * to zero chunks — never to another tenant's agreement.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { retrieveContext } from '@/lib/agent/retrieval'
import { wrapToolResponse, wrapToolError } from './utils'

const searchCollectiveAgreementsSchema = z.object({
  query: z.string().describe('Sökfrågan på svenska'),
  agreementId: z
    .string()
    .optional()
    .describe(
      'ID för ett specifikt kollektivavtal (från lookup_employee eller anställdkontexten). Anges det söks ENDAST det avtalet; utelämnas det söks alla arbetsytans avtal (eller den valda anställdas avtal om en anställd är i kontext).'
    ),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Antal resultat att returnera (1–20, standard 5)'),
})

type SearchCollectiveAgreementsInput = z.infer<
  typeof searchCollectiveAgreementsSchema
>

export function createSearchCollectiveAgreementsTool(
  workspaceId: string,
  biasAgreementId?: string | undefined
) {
  return tool({
    description: `Sök i arbetsytans kollektivavtal (uppladdade avtal) med semantisk likhet.
Använd detta verktyg när frågan rör vad kollektivavtalet säger — t.ex. uppsägningstider, arbetstider, ersättningar eller semestervillkor enligt avtalet — särskilt när en anställd är i fokus.

Skillnad mot andra sökverktyg:
- search_laws → svensk lagtext, föreskrifter och EU-rätt (den globala korpusen).
- search_workspace_files → arbetsytans övriga uppladdade filer.
- search_collective_agreements → arbetsytans kollektivavtal.
Sök i både lag och avtal när frågan gäller vad som faktiskt gäller för en anställd — lagen sätter golvet, avtalet kan avvika.

Känner du till vilket avtal som gäller för den anställda (t.ex. via lookup_employee eller anställdkontexten), skicka det som \`agreementId\` så söks bara det avtalet.

Returnerar upp till {limit} träffar rankade efter relevans. Varje träff har \`agreementId\`, \`agreementName\`, ett textutdrag (\`snippet\`), en relevanspoäng (0–1) och en \`citationKey\`. Använd EXAKT \`citationKey\`-strängen i [Källa: ...]-markeringar.

Hittas inga träffar, omformulera frågan eller sök utan agreementId.`,
    inputSchema: zodSchema(searchCollectiveAgreementsSchema),
    execute: async ({
      query,
      agreementId,
      limit,
    }: SearchCollectiveAgreementsInput) => {
      const startTime = Date.now()

      try {
        // Precedence: model param > pill-closure bias > none (AC 4).
        const effectiveSourceId = agreementId ?? biasAgreementId

        const response = await retrieveContext(query, workspaceId, {
          sourceTypes: ['COLLECTIVE_AGREEMENT'],
          topK: limit,
          ...(effectiveSourceId ? { sourceId: effectiveSourceId } : {}),
        })

        if (response.results.length === 0) {
          return wrapToolError(
            'search_collective_agreements',
            effectiveSourceId
              ? 'Inga resultat hittades i det angivna kollektivavtalet.'
              : 'Inga resultat hittades i arbetsytans kollektivavtal.',
            effectiveSourceId
              ? 'Avtalet kan sakna avsnitt om ämnet, eller så är avtals-ID:t fel. Prova att omformulera frågan eller sök utan agreementId för att söka i alla avtal. Gäller frågan lagens miniminivå, använd search_laws.'
              : 'Arbetsytan kanske inte har något uppladdat kollektivavtal om ämnet. Prova att omformulera frågan, eller använd search_laws om frågan gäller lagens regler.',
            startTime
          )
        }

        const results = response.results.map((r) => {
          const meta = (r.metadata ?? {}) as {
            agreement_name?: string
            workspace_file_id?: string
          }
          // metadata.agreement_name is the canonical display name; fall back to
          // the header (which starts with the name), then sourceId, so a result
          // is never citationless. `||` (not `??`) skips empty strings.
          const agreementName =
            meta.agreement_name || r.contextualHeader || r.sourceId
          return {
            agreementId: r.sourceId,
            agreementName,
            // The agreement's backing PDF (WorkspaceFile) — lets the citation
            // pill open the source document via QuickPreview.
            workspaceFileId: meta.workspace_file_id ?? null,
            snippet: r.content,
            relevanceScore: Math.round(r.relevanceScore * 1000) / 1000,
            // citationKey = the contextual header ("<Avtal> (Kollektivavtal)
            // > <avsnitt>") — consistent with transparency.ts's CA rendering.
            citationKey:
              r.contextualHeader || `${agreementName} (Kollektivavtal)`,
          }
        })

        return wrapToolResponse(
          'search_collective_agreements',
          results,
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_collective_agreements',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

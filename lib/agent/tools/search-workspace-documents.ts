/**
 * search_workspace_documents tool — Story 17.10: semantic search across a
 * workspace's authored styrdokument (policys, rutiner, riskbedömningar etc.,
 * `WORKSPACE_DOCUMENT` chunks indexed by Story 17.9b).
 *
 * Parallel precedent (Story 17.9c, `search-workspace-files.ts`) for USER_FILE
 * search. **DEC-1 (kept):** this tool is SEPARATE from `search_workspace_files`
 * — distinct result shapes (files: filename+category; styrdokument: title+type
 * +status) and distinct citation labels.
 *
 * DEC-2: citation key = the styrdokument `title`. Same low-risk approach
 * 17.9c used for files (title carried in `documentNumber` for the source map).
 * Title collisions are resolved by the dispatch's collision disambiguator
 * (CITE-002, AC 21).
 *
 * Isolation: `retrieveContext` is closure-scoped to `workspaceId`; its SQL
 * `workspace_id` clause + 17.9b's write-side invariant (every WORKSPACE_DOCUMENT
 * chunk carries a non-null workspace_id) guarantee a caller only ever sees its
 * own styrdokument.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { retrieveContext } from '@/lib/agent/retrieval'
import { wrapToolResponse, wrapToolError } from './utils'

const searchWorkspaceDocumentsSchema = z.object({
  query: z.string().describe('Sökfrågan på svenska'),
  limit: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .describe('Antal resultat att returnera (1–10, standard 5)'),
})

type SearchWorkspaceDocumentsInput = z.infer<
  typeof searchWorkspaceDocumentsSchema
>

export function createSearchWorkspaceDocumentsTool(workspaceId: string) {
  return tool({
    description: `Sök i arbetsytans EGNA styrdokument (policys, rutiner, riskbedömningar, handlingsplaner, checklistor, instruktioner) med semantisk likhet.

Använd detta verktyg när användaren frågar om sina egna styrdokument, vad organisationens policys eller rutiner säger, eller när du vill grunda råd i de faktiska policydokumenten — inte den allmänna lagdatabasen eller uppladdade filer.

Skillnad mot syskonverktygen:
- search_laws → svensk lagtext, föreskrifter och EU-rätt (den globala korpusen).
- search_workspace_files → arbetsytans uppladdade filer (PDF:er, kalkylblad, bevis).
- search_workspace_documents → arbetsytans egna AUTORISERADE styrdokument (det här verktyget).
Sök i flera när en fråga rör hur företagets policys förhåller sig till ett lagkrav eller till bevisunderlag.

Returnerar upp till {limit} träffar rankade efter relevans. Varje träff har \`documentId\`, \`title\`, \`documentType\`, \`status\`, ett textutdrag (\`snippet\`), en relevanspoäng (0–1) och en \`citationKey\`. Använd EXAKT \`citationKey\`-strängen i [Källa: ...]-markeringar.

Hittas inga träffar, omformulera frågan eller använd bredare söktermer. Använd \`get_workspace_document\` för att läsa hela ett styrdokuments innehåll, eller \`list_workspace_documents\` för att lista existerande styrdokument utan en sökfråga.`,
    inputSchema: zodSchema(searchWorkspaceDocumentsSchema),
    execute: async ({ query, limit }: SearchWorkspaceDocumentsInput) => {
      const startTime = Date.now()

      try {
        const response = await retrieveContext(query, workspaceId, {
          sourceTypes: ['WORKSPACE_DOCUMENT'],
          topK: limit,
        })

        if (response.results.length === 0) {
          return wrapToolError(
            'search_workspace_documents',
            'Inga resultat hittades bland era styrdokument.',
            'Försök att omformulera sökningen eller använd bredare söktermer. Använd list_workspace_documents om du vill bläddra bland alla styrdokument istället.',
            startTime
          )
        }

        const results = response.results.map((r) => {
          // 17.9b's WORKSPACE_DOCUMENT chunks carry { title, document_type,
          // status, content_hash } in metadata. Cast and fall back so a
          // malformed chunk never produces a citationless result. `||` (not
          // `??`) skips empty-string headers — same pattern as 17.9c.
          const meta = (r.metadata ?? {}) as {
            title?: string
            document_type?: string
            status?: string
            version_number?: number
          }
          const title = meta.title || r.contextualHeader || r.sourceId
          return {
            documentId: r.sourceId,
            title,
            documentType: meta.document_type ?? null,
            // Story 17.10b AC 11: default to 'APPROVED' for legacy chunks
            // indexed under 17.9b before status was uniformly written. The
            // backfill script (Task 7) overwrites these in-place; this default
            // is the read-side safety net so the agent never sees a null tier.
            status: meta.status ?? 'APPROVED',
            versionNumber: meta.version_number ?? null,
            snippet: r.content,
            relevanceScore: Math.round(r.relevanceScore * 1000) / 1000,
            // DEC-2: citationKey = title. The agent decides bracket form by
            // reading `status`: APPROVED → [Källa: <title>], DRAFT/IN_REVIEW
            // → [Utkast: <title>] (system-prompt directive, AC 12).
            citationKey: title,
          }
        })

        return wrapToolResponse(
          'search_workspace_documents',
          results,
          startTime
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_workspace_documents',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

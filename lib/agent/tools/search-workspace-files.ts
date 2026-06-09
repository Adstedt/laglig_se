/**
 * search_workspace_files tool — semantic search across a workspace's OWN uploaded
 * files (USER_FILE chunks). Story 17.9c — the first production consumer of the
 * USER_FILE index that Story 17.9 wrote (and the `sourceTypes` retrieval option).
 *
 * Mirrors `search-laws.ts` (same `tool()` shape, `wrapToolResponse`/`wrapToolError`,
 * `startTime` telemetry), but differs in three ways:
 *   1. Queries `sourceTypes: ['USER_FILE']` — NEVER `LEGAL_DOCUMENT`, never widened.
 *   2. Results are filename/category-shaped (files have no document number).
 *   3. `citationKey` = the filename, matching the `[Källa: <filename>]` rendering the
 *      system already uses for USER_FILE (`transparency.ts`).
 *
 * Isolation: `retrieveContext` is closure-scoped to `workspaceId`; its SQL
 * `workspace_id` clause + Story 17.9's write-side invariant (every USER_FILE chunk has
 * a non-null workspace_id) together guarantee a caller only ever sees its own files.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { retrieveContext } from '@/lib/agent/retrieval'
import { wrapToolResponse, wrapToolError } from './utils'

const searchWorkspaceFilesSchema = z.object({
  query: z.string().describe('Sökfrågan på svenska'),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Antal resultat att returnera (1–20, standard 5)'),
})

type SearchWorkspaceFilesInput = z.infer<typeof searchWorkspaceFilesSchema>

export function createSearchWorkspaceFilesTool(workspaceId: string) {
  return tool({
    description: `Sök i arbetsytans EGNA uppladdade filer (policys, rutiner, avtal, bevis-PDF:er, kalkylblad) med semantisk likhet.
Använd detta verktyg när användaren frågar om sina egna dokument, vad deras interna rutiner/policys säger, eller vill ha råd grundat i deras faktiska underlag — inte i den allmänna lagdatabasen.

Skillnad mot search_laws:
- search_laws → svensk lagtext, föreskrifter och EU-rätt (den globala korpusen).
- search_workspace_files → arbetsytans egna uppladdade filer.
Sök i båda när en fråga rör hur företagets egna dokument förhåller sig till ett lagkrav.

Returnerar upp till {limit} träffar rankade efter relevans. Varje träff har \`fileId\`, \`filename\`, \`category\`, ett textutdrag (\`snippet\`), en relevanspoäng (0–1) och en \`citationKey\`. Använd EXAKT \`citationKey\`-strängen i [Källa: ...]-markeringar.

Hittas inga träffar, omformulera frågan eller använd bredare söktermer.`,
    inputSchema: zodSchema(searchWorkspaceFilesSchema),
    execute: async ({ query, limit }: SearchWorkspaceFilesInput) => {
      const startTime = Date.now()

      try {
        const response = await retrieveContext(query, workspaceId, {
          sourceTypes: ['USER_FILE'],
          topK: limit,
        })

        if (response.results.length === 0) {
          return wrapToolError(
            'search_workspace_files',
            'Inga resultat hittades bland era uppladdade filer.',
            'Försök att omformulera sökningen eller använd bredare söktermer. Kontrollera även att relevanta filer har laddats upp och bearbetats.',
            startTime
          )
        }

        const results = response.results.map((r) => {
          const meta = (r.metadata ?? {}) as {
            filename?: string
            category?: string
          }
          // contextual_header is "filename (CATEGORY)"; metadata.filename is the
          // canonical source. Fall back to header, then sourceId, so a result is
          // never citationless. `||` (not `??`) so an empty-string header is skipped.
          const filename = meta.filename || r.contextualHeader || r.sourceId
          return {
            fileId: r.sourceId,
            filename,
            category: meta.category ?? null,
            snippet: r.content,
            relevanceScore: Math.round(r.relevanceScore * 1000) / 1000,
            // citationKey = filename (no document number for files) — consistent
            // with the existing USER_FILE rendering in transparency.ts.
            citationKey: filename,
          }
        })

        return wrapToolResponse('search_workspace_files', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_workspace_files',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

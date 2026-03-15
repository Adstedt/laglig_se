/**
 * search_laws tool — semantic search across legal document chunks
 * Story 14.7a, Task 2 (AC: 7)
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { retrieveContext } from '@/lib/agent/retrieval'
import { wrapToolResponse, wrapToolError } from './utils'

const searchLawsSchema = z.object({
  query: z.string().describe('The search query in Swedish'),
  contentType: z
    .enum(['SFS_LAW', 'AGENCY_REGULATION', 'EU_REGULATION', 'EU_DIRECTIVE'])
    .optional()
    .describe('Filter to a specific document type'),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Number of results to return'),
})

type SearchLawsInput = z.infer<typeof searchLawsSchema>

export function createSearchLawsTool(workspaceId: string) {
  return tool({
    description: `Search Swedish legal documents by semantic similarity.
Use this tool when the user asks about a legal topic, regulation, or compliance requirement.
Returns the most relevant passages from laws (SFS), agency regulations (AFS, BFS, etc.), and EU legislation.
The search understands Swedish legal terminology and natural language queries.

Example queries:
- "arbetsgivarens skyldigheter för skyddsutrustning"
- "regler för kemikaliehantering"
- "GDPR-krav för personuppgifter"

Returns up to {limit} results ranked by relevance. Each result includes the passage text, document number, and a relevance score (0-1).

If no results are found, try rephrasing the query or broadening the search (e.g., remove contentType filter).`,
    inputSchema: zodSchema(searchLawsSchema),
    execute: async ({ query, contentType, limit }: SearchLawsInput) => {
      const startTime = Date.now()

      try {
        const response = await retrieveContext(query, workspaceId, {
          sourceType: 'LEGAL_DOCUMENT',
          ...(contentType != null && { contentType }),
          topK: limit,
        })

        if (response.results.length === 0) {
          return wrapToolError(
            'search_laws',
            'Inga resultat hittades.',
            'Försök att omformulera sökningen eller ta bort eventuella filter. Bredare söktermer ger ofta fler träffar.',
            startTime
          )
        }

        const results = response.results.map((r) => ({
          contextualHeader: r.contextualHeader,
          documentNumber: r.documentNumber,
          slug: r.slug,
          relevanceScore: Math.round(r.relevanceScore * 1000) / 1000,
          path: r.path,
          snippet: r.content,
        }))

        return wrapToolResponse('search_laws', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_laws',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

/**
 * search_law_list_items tool — find a LawListItem in the workspace's bevaknings-
 * lista by law name or SFS number. Story 19.4a.
 *
 * The entry point into the company compliance graph for a GLOBAL chat: the agent
 * resolves *which* law-list item the user means, then uses the returned
 * `lawListItemId` with the write tools (add_obligation / update_compliance_status /
 * add_context_note) or the 19.4 entity-readers.
 *
 * Title/SFS string match (NOT semantic RAG) — discovery, not retrieval. Workspace-
 * scoped via `law_list.workspace_id`.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { wrapToolResponse, wrapToolError } from './utils'
import { complianceStatusLabel } from './reader-utils'

// Swedish definite-article endings, longest-first so "lagerna" strips "erna"
// (not "en"/"na"). Used to make substring matching robust to definite forms:
// users say "arbetsmiljölagen" but the title is stored as "Arbetsmiljölag …".
const DEFINITE_SUFFIXES = ['erna', 'arna', 'orna', 'en', 'et', 'na', 'n']

/**
 * Strip one trailing Swedish definite suffix when it leaves a ≥4-char stem.
 * Keeps specific compounds matchable ("arbetsmiljölagen" → "arbetsmiljölag")
 * while avoiding over-broad 3-char stems ("lagen" → "lag" is rejected, so a
 * vague query doesn't match every law with "lag" in the title). Null = nothing
 * safe to strip.
 */
function definiteStem(token: string): string | null {
  for (const suf of DEFINITE_SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 4) {
      return token.slice(0, -suf.length)
    }
  }
  return null
}

/**
 * Tokenize a discovery query into match-candidate groups: one group per
 * whitespace token (edge-punctuation trimmed, ≥3 chars, ':' kept for SFS like
 * "1977:1160"), each group = [token] or [token, definiteStem]. A document
 * matches when EVERY group has a candidate that's a substring of title or
 * document_number (AND across tokens, OR within a token's candidates × fields).
 */
function buildDocumentWhere(query: string): Prisma.LegalDocumentWhereInput {
  const groups = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}:]+|[^\p{L}\p{N}:]+$/gu, ''))
    .filter((t) => t.length >= 3)
    .map((t) => {
      const stem = definiteStem(t)
      return stem ? [t, stem] : [t]
    })

  // Fallback for a too-short/empty query (e.g. a 2-char term): match it raw.
  const effective = groups.length > 0 ? groups : [[query.toLowerCase().trim()]]

  return {
    AND: effective.map((candidates) => ({
      OR: candidates.flatMap((c) => [
        { title: { contains: c, mode: 'insensitive' as const } },
        { document_number: { contains: c, mode: 'insensitive' as const } },
      ]),
    })),
  }
}

const schema = z.object({
  query: z
    .string()
    .describe(
      'Sökord — lagens namn eller SFS-nummer (t.ex. "arbetsmiljö" eller "2018:218")'
    ),
  limit: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe('Antal träffar att returnera (1–20, standard 5)'),
})

type Input = z.infer<typeof schema>

export function createSearchLawListItemsTool(workspaceId: string) {
  return tool({
    description: `Sök i arbetsytans bevakningslista (laglistan) efter en specifik laglistpost via lagens namn eller SFS-nummer.
Använd detta när du behöver veta VILKEN laglistpost användaren menar — t.ex. i en global chatt innan du lägger till en kravpunkt, ändrar efterlevnadsstatus eller läser postens detaljer.

Varje träff har \`lawListItemId\` (använd det för add_obligation / update_compliance_status / add_context_note), \`title\`, \`sfsNumber\`, \`complianceStatus\` och \`listName\` — vilken lista posten ligger i. Om samma lag finns i flera listor får du en träff per lista; använd \`listName\` för att välja rätt.

Om du inte får träff: försök igen med ett kortare ord/stam (t.ex. "arbetsmiljö" istället för "arbetsmiljölagen") eller med SFS-numret, INNAN du drar slutsatsen att lagen saknas i listan.

OBS: detta verktyg hittar POSTER i listan, inte lagtext. För att citera lagtext, använd search_laws — konstruera aldrig en [Källa:]-hänvisning från dessa träffar.`,
    inputSchema: zodSchema(schema),
    execute: async ({ query, limit }: Input) => {
      const startTime = Date.now()

      try {
        const items = await prisma.lawListItem.findMany({
          where: {
            // Workspace isolation (AC 10): scope via the parent list.
            law_list: { workspace_id: workspaceId },
            // Swedish definite-form fix: tokenized + definite-suffix-stripped
            // matching so "arbetsmiljölagen" finds the stored "Arbetsmiljölag …".
            document: buildDocumentWhere(query),
          },
          select: {
            id: true,
            compliance_status: true,
            document: { select: { title: true, document_number: true } },
            law_list: { select: { name: true } },
          },
          take: limit,
        })

        if (items.length === 0) {
          return wrapToolError(
            'search_law_list_items',
            'Inga laglistposter matchade sökningen.',
            'Försök med ett annat lagnamn eller SFS-nummer. Kontrollera att lagen finns i arbetsytans bevakningslista.',
            startTime
          )
        }

        const results = items.map((it) => ({
          lawListItemId: it.id,
          title:
            it.document?.title ?? it.document?.document_number ?? 'Okänd lag',
          sfsNumber: it.document?.document_number ?? null,
          complianceStatus: complianceStatusLabel(it.compliance_status),
          // SF-1: disambiguates the same SFS appearing across multiple lists.
          listName: it.law_list?.name ?? null,
        }))

        return wrapToolResponse('search_law_list_items', results, startTime)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return wrapToolError(
          'search_law_list_items',
          `Sökningen misslyckades: ${message}`,
          'Ett tekniskt fel uppstod. Försök igen om en stund.',
          startTime
        )
      }
    },
  })
}

/**
 * search_workspace_documents tool — Story 17.10 + extended by Story 17.18.
 *
 * **17.10 model:** semantic search across a workspace's authored styrdokument
 * (policys, rutiner, riskbedömningar etc., `WORKSPACE_DOCUMENT` chunks indexed
 * by Story 17.9b → 17.10b). One result row per chunk hit. Title collisions
 * resolved by the dispatch's collision disambiguator (CITE-002, AC 21).
 *
 * **17.18 extension:** under Story 17.16's dual-pointer schema + 17.18 AC 1's
 * dual-tier indexing, a doc can carry BOTH approved-tier AND draft-tier chunks
 * simultaneously. This tool:
 *
 *  - **AC 2:** reads `metadata.tier` (`'APPROVED'` | `'DRAFT'`) on each chunk
 *    so the agent can route citations correctly. Legacy untagged chunks
 *    (pre-17.18, `metadata.tier` absent) default to `'APPROVED'` — Story 17.18
 *    AC 1's self-healing migration replaces them on next reindex.
 *  - **AC 3 dedup:** at most ONE approved-tier hit AND ONE draft-tier hit per
 *    document. Without this, a dual-state doc with the SAME conceptual content
 *    in both tiers would return two near-duplicate chunks per query — noise
 *    the agent has to reason away.
 *  - **AC 3 dualState flag:** each hit carries `dualState: boolean` indicating
 *    whether the source doc has BOTH pointers set. The agent uses this to
 *    decide whether to hedge approved-tier answers with `[Utkast:]` mentions.
 *  - **AC 3 citationKey (SF-2):** approved-tier hits keep the clean
 *    `"<title>"`. Draft-tier hits become `"<title> (utkast v<draft.version_number>)"`
 *    using the draft row's actual version_number (not approved+1 — multi-cycle
 *    promote/Förkasta can put draft and approved on non-adjacent numbers).
 *
 * Isolation: `retrieveContext` is closure-scoped to `workspaceId`; its SQL
 * `workspace_id` clause + 17.9b's write-side invariant (every WORKSPACE_DOCUMENT
 * chunk carries a non-null workspace_id) guarantee a caller only ever sees its
 * own styrdokument. The dualState lookup adds a workspace-scoped findMany on
 * `WorkspaceDocument` as defence-in-depth.
 */

import { tool, zodSchema } from 'ai'
import { z } from 'zod/v4'
import { retrieveContext } from '@/lib/agent/retrieval'
import { prisma } from '@/lib/prisma'
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

/**
 * **Story 17.18 AC 3 dedup:** for each `documentId`, keep at most one hit per
 * tier — the highest-ranked (first-encountered, since `retrieveContext` returns
 * hits ordered by relevance). Dual-state docs return ≤ 2 hits per doc (one
 * APPROVED + one DRAFT); single-state docs return ≤ 1 hit (their only tier).
 *
 * Operates on the raw retrieval hit rows BEFORE the shape mapping so the
 * downstream batched dualState lookup operates on a deduplicated docId set.
 */
function dedupHitsByTier<
  T extends {
    sourceId: string
    metadata?: Record<string, unknown> | null
  },
>(hits: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const hit of hits) {
    const tier = (hit.metadata as { tier?: string } | null)?.tier ?? 'APPROVED'
    const key = `${hit.sourceId}::${tier}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}

export function createSearchWorkspaceDocumentsTool(workspaceId: string) {
  return tool({
    description: `Sök i arbetsytans EGNA styrdokument (policys, rutiner, riskbedömningar, handlingsplaner, checklistor, instruktioner) med semantisk likhet.

Använd detta verktyg när användaren frågar om sina egna styrdokument, vad organisationens policys eller rutiner säger, eller när du vill grunda råd i de faktiska policydokumenten — inte den allmänna lagdatabasen eller uppladdade filer.

Skillnad mot syskonverktygen:
- search_laws → svensk lagtext, föreskrifter och EU-rätt (den globala korpusen).
- search_workspace_files → arbetsytans uppladdade filer (PDF:er, kalkylblad, bevis).
- search_workspace_documents → arbetsytans egna AUTORISERADE styrdokument (det här verktyget).
Sök i flera när en fråga rör hur företagets policys förhåller sig till ett lagkrav eller till bevisunderlag.

Returnerar upp till {limit} träffar rankade efter relevans. Varje träff har \`documentId\`, \`title\`, \`documentType\`, \`status\`, \`tier\` ('APPROVED' eller 'DRAFT' — Story 17.18), \`dualState\` (true om dokumentet har BÅDE en godkänd version OCH ett pågående utkast), ett textutdrag (\`snippet\`), en relevanspoäng (0–1) och en \`citationKey\`. Använd EXAKT \`citationKey\`-strängen i [Källa: ...]- eller [Utkast: ...]-markeringar.

För dokument i dubbeltillstånd (\`dualState: true\`) returneras MAX en träff per tier per dokument — en för den godkända versionen ([Källa:]) och en för utkastet ([Utkast:]). Citera den godkända versionen som den auktoritativa policyn och nämn utkastet endast om det materiellt påverkar svaret ("Ett pågående utkast föreslår…").

Hittas inga träffar, omformulera frågan eller använd bredare söktermer. Använd \`get_workspace_document\` för att läsa hela ett styrdokuments innehåll, eller \`list_workspace_documents\` för att lista existerande styrdokument utan en sökfråga.`,
    inputSchema: zodSchema(searchWorkspaceDocumentsSchema),
    execute: async ({ query, limit }: SearchWorkspaceDocumentsInput) => {
      const startTime = Date.now()

      try {
        const response = await retrieveContext(query, workspaceId, {
          sourceTypes: ['WORKSPACE_DOCUMENT'],
          // Story 17.18 AC 3: request 2× topK so we can dedup to one-per-tier
          // per doc and still hit the user's requested limit. The "worst case"
          // is a search where every dual-state doc returns both tiers; without
          // the 2× pull, the dedup would silently halve the result count.
          topK: limit * 2,
        })

        if (response.results.length === 0) {
          return wrapToolError(
            'search_workspace_documents',
            'Inga resultat hittades bland era styrdokument.',
            'Försök att omformulera sökningen eller använd bredare söktermer. Använd list_workspace_documents om du vill bläddra bland alla styrdokument istället.',
            startTime
          )
        }

        // Story 17.18 AC 3: tier-scoped dedup THEN trim to user's limit.
        const deduped = dedupHitsByTier(response.results).slice(0, limit)

        // Story 17.18 AC 3: batched dualState + draft.version_number lookup
        // for citationKey + dualState flag. Workspace-scoped (defence-in-depth
        // on top of the closure-scoped retrieveContext).
        const docIds = [...new Set(deduped.map((r) => r.sourceId))]
        const docs = await prisma.workspaceDocument.findMany({
          where: { id: { in: docIds }, workspace_id: workspaceId },
          select: {
            id: true,
            current_approved_version_id: true,
            current_draft_version_id: true,
            current_draft_version: { select: { version_number: true } },
          },
        })
        const docStateMap = new Map(
          docs.map((d) => [
            d.id,
            {
              dualState:
                d.current_approved_version_id != null &&
                d.current_draft_version_id != null,
              draftVersionNumber:
                d.current_draft_version?.version_number ?? null,
            },
          ])
        )

        const results = deduped.map((r) => {
          // 17.9b's WORKSPACE_DOCUMENT chunks carry { title, document_type,
          // status, content_hash, tier? } in metadata. `||` (not `??`) skips
          // empty-string headers — same pattern as 17.9c.
          const meta = (r.metadata ?? {}) as {
            title?: string
            document_type?: string
            status?: string
            version_number?: number
            tier?: 'APPROVED' | 'DRAFT'
          }
          const title = meta.title || r.contextualHeader || r.sourceId
          // Story 17.18 AC 2: legacy untagged chunks default to APPROVED tier.
          const tier: 'APPROVED' | 'DRAFT' = meta.tier ?? 'APPROVED'
          const state = docStateMap.get(r.sourceId)
          const dualState = state?.dualState ?? false

          // Story 17.18 AC 3 / SF-2: draft-tier citationKey embeds the draft's
          // actual version_number (NOT approved+1). Fallback to a versionless
          // form if the lookup didn't surface a version (defensive — should
          // not happen post-17.16 backfill).
          const citationKey =
            tier === 'DRAFT'
              ? state?.draftVersionNumber != null
                ? `${title} (utkast v${state.draftVersionNumber})`
                : `${title} (utkast)`
              : title

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
            // Story 17.18 AC 2: explicit tier discriminator for the agent.
            tier,
            // Story 17.18 AC 3: dualState flag tells the agent whether to
            // hedge approved-tier answers with `[Utkast:]` mentions.
            dualState,
            snippet: r.content,
            relevanceScore: Math.round(r.relevanceScore * 1000) / 1000,
            // DEC-2 + Story 17.18 SF-2: approved tier keeps clean title;
            // draft tier carries the explicit version suffix.
            citationKey,
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

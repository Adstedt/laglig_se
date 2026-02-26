/* eslint-disable no-console */
/**
 * Retrieval Quality Benchmark — User Query Simulation
 * Story 14.3
 *
 * Simulates 50+ realistic questions from compliance officers, HR managers,
 * and operations staff. Displays what the RAG pipeline would return so we
 * can evaluate relevance.
 *
 * Usage:
 *   npx tsx scripts/benchmark-retrieval.ts
 *   npx tsx scripts/benchmark-retrieval.ts --top 10
 *   npx tsx scripts/benchmark-retrieval.ts --compact
 *   npx tsx scripts/benchmark-retrieval.ts --compact --rerank
 *   npx tsx scripts/benchmark-retrieval.ts --compact --rerank --rerank-model rerank-v4.0-fast
 *   npx tsx scripts/benchmark-retrieval.ts --compact --rerank --rerank-top 3
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../lib/prisma'
import { generateEmbedding, vectorToString } from '../lib/chunks/embed-chunks'
import { rerank, buildRerankText } from '../lib/search/rerank'
import type { RerankOptions } from '../lib/search/rerank'

const TOP_K = parseInt(
  process.argv.find((_, i, arr) => arr[i - 1] === '--top') ?? '5',
  10
)
const COMPACT = process.argv.includes('--compact')
const RERANK = process.argv.includes('--rerank')
const RERANK_MODEL = (process.argv.find(
  (_, i, arr) => arr[i - 1] === '--rerank-model'
) ?? 'rerank-v4.0-pro') as RerankOptions['model']
const RERANK_TOP = parseInt(
  process.argv.find((_, i, arr) => arr[i - 1] === '--rerank-top') ??
    String(TOP_K),
  10
)
const OVERFETCH_MULTIPLIER = 4

// ============================================================================
// Realistic user queries — what actual users would type
// ============================================================================

interface UserQuery {
  query: string
  persona: string // who's asking
}

const userQueries: UserQuery[] = [
  // ── HR Manager questions ─────────────────────────────────────────────
  {
    query: 'Vi ska anställa en person på deltid, vad behöver vi tänka på?',
    persona: 'HR',
  },
  {
    query:
      'En anställd har bett om föräldraledighet men vi har mycket att göra, kan vi neka?',
    persona: 'HR',
  },
  {
    query: 'Hur lång uppsägningstid gäller om vi behöver säga upp personal?',
    persona: 'HR',
  },
  {
    query: 'Vad gäller kring provanställning, hur länge får den vara?',
    persona: 'HR',
  },
  {
    query:
      'En medarbetare vill jobba hemifrån tre dagar i veckan, vad säger lagen?',
    persona: 'HR',
  },
  {
    query:
      'Vi misstänker att en anställd blir mobbad av sin chef, vad måste vi göra?',
    persona: 'HR',
  },
  {
    query: 'Måste vi ha en visselblåsarfunktion? Vi är 60 anställda.',
    persona: 'HR',
  },
  {
    query: 'Hur mycket övertid får en anställd jobba per månad?',
    persona: 'HR',
  },
  {
    query:
      'En anställd har begärt att få se sina personuppgifter, hur hanterar vi det?',
    persona: 'HR',
  },
  {
    query: 'Vad händer om vi inte betalar ut semesterersättning i tid?',
    persona: 'HR',
  },
  { query: 'Får vi kräva läkarintyg från första sjukdagen?', persona: 'HR' },
  {
    query: 'Vi vill införa kameraövervakning på kontoret, är det tillåtet?',
    persona: 'HR',
  },
  {
    query: 'Vad gäller för anställda som vill vara lediga för att studera?',
    persona: 'HR',
  },
  { query: 'Måste vi erbjuda friskvårdsbidrag?', persona: 'HR' },

  // ── Arbetsmiljöansvarig / Safety Officer ─────────────────────────────
  {
    query: 'Vi ska göra en riskbedömning av kontoret, vad ska vi gå igenom?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Hur ofta måste vi genomföra skyddsronder?',
    persona: 'Arbetsmiljö',
  },
  {
    query:
      'En anställd skadade sig på jobbet, vad måste vi rapportera och till vem?',
    persona: 'Arbetsmiljö',
  },
  {
    query:
      'Vad krävs för att uppfylla kraven på systematiskt arbetsmiljöarbete?',
    persona: 'Arbetsmiljö',
  },
  { query: 'Behöver vi ha företagshälsovård?', persona: 'Arbetsmiljö' },
  {
    query:
      'Vi har anställda som jobbar ensamma kvällstid, vilka regler gäller?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Vilken temperatur måste vi hålla på kontoret?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Vi renoverar kontoret, vilka krav finns på ventilation?',
    persona: 'Arbetsmiljö',
  },
  {
    query:
      'En gravid medarbetare undrar om hon får fortsätta jobba med kemikalier',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Hur ska vi hantera hot och våld mot personal i receptionen?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Vi har bullriga maskiner i verkstaden, vilka gränsvärden gäller?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Måste alla anställda ha tillgång till ett fönster med dagsljus?',
    persona: 'Arbetsmiljö',
  },
  {
    query: 'Vi behöver välja nya kontorsstolar, finns det ergonomikrav?',
    persona: 'Arbetsmiljö',
  },

  // ── Operations / VD / Compliance Officer ─────────────────────────────
  {
    query: 'Vi har fått besök av Arbetsmiljöverket, vad kan hända nu?',
    persona: 'Compliance',
  },
  {
    query: 'Vad kostar det om vi bryter mot arbetsmiljölagen?',
    persona: 'Compliance',
  },
  {
    query: 'Vi ska öppna ett lager, vilka regler gäller för brandskydd?',
    persona: 'Compliance',
  },
  { query: 'Behöver vi en brandskyddspolicy?', persona: 'Compliance' },
  {
    query: 'Vi hanterar kemikalier i produktionen, vilka lagar gäller?',
    persona: 'Compliance',
  },
  {
    query: 'Vilka krav ställs på oss som fastighetsägare?',
    persona: 'Compliance',
  },
  {
    query: 'Vi vill börja sälja livsmedel, vilka tillstånd behövs?',
    persona: 'Compliance',
  },
  {
    query: 'Vad innebär egenkontroll enligt miljöbalken?',
    persona: 'Compliance',
  },
  {
    query: 'Vi har lastbilar, vad gäller för kör- och vilotider?',
    persona: 'Compliance',
  },
  { query: 'Måste vi ha en miljöpolicy?', persona: 'Compliance' },
  {
    query:
      'Vi vill importera kemiska produkter från Kina, vilka regler gäller?',
    persona: 'Compliance',
  },
  { query: 'Hur hanterar vi farligt avfall korrekt?', persona: 'Compliance' },
  {
    query: 'Vi ska bygga till fabriken, behöver vi bygglov?',
    persona: 'Compliance',
  },
  {
    query: 'Vilka skyldigheter har vi enligt diskrimineringslagen?',
    persona: 'Compliance',
  },

  // ── IT / Informationssäkerhet ────────────────────────────────────────
  { query: 'Vi har haft ett dataintrång, måste vi anmäla det?', persona: 'IT' },
  {
    query: 'Vad säger lagen om lagring av personuppgifter i molnet?',
    persona: 'IT',
  },
  { query: 'Vilka krav ställer NIS-direktivet på oss?', persona: 'IT' },

  // ── Scenario-based (real situations) ─────────────────────────────────
  {
    query: 'En kund halkade i vår butik och bröt armen, vad gör vi?',
    persona: 'Scenario',
  },
  {
    query:
      'Det har uppstått en konflikt mellan två medarbetare som blivit väldigt allvarlig',
    persona: 'Scenario',
  },
  {
    query: 'Vi har upptäckt att en chef trakasserar en anställd',
    persona: 'Scenario',
  },
  {
    query: 'Vår ventilationsanläggning har gått sönder mitt i sommaren',
    persona: 'Scenario',
  },
  {
    query: 'Vi vill säga upp en anställd som inte presterar, vad gäller?',
    persona: 'Scenario',
  },
  { query: 'En anställd vägrar använda skyddsutrustning', persona: 'Scenario' },
  {
    query: 'Vi fick en faktura från Arbetsmiljöverket på en sanktionsavgift',
    persona: 'Scenario',
  },
  {
    query: 'Facket kräver förhandling om vår planerade omorganisation',
    persona: 'Scenario',
  },
  {
    query: 'En anställd har rapporterat att hen mår dåligt av stress på jobbet',
    persona: 'Scenario',
  },
  {
    query: 'Vi har ett kemikaliespill i lagret, vad är vi skyldiga att göra?',
    persona: 'Scenario',
  },
  {
    query:
      'Vi behöver minska personalstyrkan med 10 personer, hur går vi tillväga?',
    persona: 'Scenario',
  },
]

// ============================================================================
// Search
// ============================================================================

interface SearchResult {
  contextual_header: string
  content: string
  context_prefix: string | null
  similarity: number
  relevanceScore?: number
}

async function searchSimilar(
  queryEmbedding: number[],
  topK: number,
  fullContent: boolean
): Promise<SearchResult[]> {
  const vecStr = vectorToString(queryEmbedding)

  await prisma.$executeRaw`SET hnsw.ef_search = 100`

  if (fullContent) {
    return prisma.$queryRaw<SearchResult[]>`
      SELECT
        contextual_header,
        content,
        context_prefix,
        1 - (embedding <=> ${vecStr}::vector) as similarity
      FROM content_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vecStr}::vector
      LIMIT ${topK}
    `
  }

  return prisma.$queryRaw<SearchResult[]>`
    SELECT
      contextual_header,
      LEFT(content, 200) as content,
      LEFT(context_prefix, 120) as context_prefix,
      1 - (embedding <=> ${vecStr}::vector) as similarity
    FROM content_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vecStr}::vector
    LIMIT ${topK}
  `
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const stats = await prisma.$queryRaw<
    Array<{ total: bigint; with_embedding: bigint; with_prefix: bigint }>
  >`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embedding,
      COUNT(context_prefix) as with_prefix
    FROM content_chunks
  `

  const fetchK = RERANK ? TOP_K * OVERFETCH_MULTIPLIER : TOP_K

  console.log('=== Retrieval Quality Benchmark — User Query Simulation ===')
  console.log(
    `Chunks: ${Number(stats[0]?.total ?? 0).toLocaleString()} | Queries: ${userQueries.length} | Top-K: ${TOP_K}`
  )
  if (RERANK) {
    console.log(
      `Rerank: ${RERANK_MODEL} | Over-fetch: ${fetchK} → top ${RERANK_TOP}`
    )
  }
  console.log()

  const similarities: number[] = []
  const rerankScores: number[] = []
  const rerankLatencies: number[] = []
  const personaStats: Record<
    string,
    { count: number; simSum: number; reScoreSum: number }
  > = {}
  let queryNum = 0
  let rerankSuccessCount = 0

  for (const uq of userQueries) {
    queryNum++

    try {
      const { embedding } = await generateEmbedding(uq.query, '', '')
      let results = await searchSimilar(embedding, fetchK, RERANK)

      // Rerank if enabled
      if (RERANK && results.length > 1) {
        const docs = results.map((r) => ({
          text: buildRerankText(
            r.content,
            r.context_prefix,
            r.contextual_header
          ),
          ...r,
        }))

        const rerankResult = await rerank(uq.query, docs, {
          model: RERANK_MODEL,
          topN: RERANK_TOP,
        })

        if (rerankResult.reranked) {
          rerankSuccessCount++
          rerankLatencies.push(rerankResult.latencyMs)
          results = rerankResult.results.map((r) => ({
            contextual_header: r.contextual_header,
            content: r.content,
            context_prefix: r.context_prefix,
            similarity: Number(r.similarity),
            relevanceScore: r.relevanceScore,
          }))
        } else {
          // Rerank failed — trim to TOP_K
          results = results.slice(0, RERANK_TOP)
        }
      }

      const topSim = Number(results[0]?.similarity ?? 0)
      similarities.push(topSim)

      const topReScore = results[0]?.relevanceScore ?? 0
      if (RERANK) rerankScores.push(topReScore)

      if (!personaStats[uq.persona])
        personaStats[uq.persona] = { count: 0, simSum: 0, reScoreSum: 0 }
      personaStats[uq.persona].count++
      personaStats[uq.persona].simSum += topSim
      if (RERANK) personaStats[uq.persona].reScoreSum += topReScore

      // Collect unique source laws from results
      const sources = [
        ...new Set(
          results.map((r) => {
            const parts = r.contextual_header.split(' > ')[0]
            return parts?.substring(0, 80) || '?'
          })
        ),
      ]

      if (COMPACT) {
        const scoreTag =
          RERANK && results[0]?.relevanceScore
            ? `[vec:${topSim.toFixed(3)} re:${topReScore.toFixed(3)}]`
            : `[${topSim.toFixed(3)}]`
        console.log(
          `${String(queryNum).padStart(2)}. ${scoreTag} [${uq.persona.padEnd(11)}] ${uq.query}`
        )
        console.log(`    → ${sources.slice(0, 3).join(' | ')}`)
      } else {
        console.log(`${'─'.repeat(80)}`)
        console.log(`Q${queryNum} [${uq.persona}]: "${uq.query}"`)
        console.log()

        for (let i = 0; i < results.length; i++) {
          const r = results[i]!
          const sim = Number(r.similarity).toFixed(4)
          const header = r.contextual_header.substring(0, 90)
          const reTag =
            r.relevanceScore !== undefined
              ? ` re:${r.relevanceScore.toFixed(4)}`
              : ''
          console.log(`  ${i + 1}. [vec:${sim}${reTag}] ${header}`)
          if (r.context_prefix) {
            console.log(
              `     Prefix: ${(r.context_prefix ?? '').substring(0, 120)}`
            )
          }
          console.log(
            `     "${r.content.substring(0, 200).replace(/\n/g, ' ').trim()}"`
          )
          console.log()
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR on Q${queryNum}: ${msg}`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))

  similarities.sort((a, b) => a - b)
  const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length
  const median = similarities[Math.floor(similarities.length / 2)]!
  const p10 = similarities[Math.floor(similarities.length * 0.1)]!
  const p90 = similarities[Math.floor(similarities.length * 0.9)]!

  console.log(`\nSimilarity distribution (top-1):`)
  console.log(`  Average:  ${avg.toFixed(4)}`)
  console.log(`  Median:   ${median.toFixed(4)}`)
  console.log(`  P10:      ${p10.toFixed(4)} (weakest 10%)`)
  console.log(`  P90:      ${p90.toFixed(4)} (strongest 10%)`)
  console.log(`  Min:      ${similarities[0]!.toFixed(4)}`)
  console.log(
    `  Max:      ${similarities[similarities.length - 1]!.toFixed(4)}`
  )

  // Histogram
  const buckets = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]
  console.log(`\n  Distribution:`)
  for (let i = 0; i < buckets.length; i++) {
    const lo = buckets[i]!
    const hi = buckets[i + 1] ?? 1.0
    const count = similarities.filter((s) => s >= lo && s < hi).length
    const bar = '█'.repeat(count)
    console.log(`    ${lo.toFixed(2)}-${hi.toFixed(2)}: ${bar} ${count}`)
  }

  if (RERANK && rerankScores.length > 0) {
    const reAvg = rerankScores.reduce((a, b) => a + b, 0) / rerankScores.length
    const reSorted = [...rerankScores].sort((a, b) => a - b)
    const reMedian = reSorted[Math.floor(reSorted.length / 2)]!
    const reP10 = reSorted[Math.floor(reSorted.length * 0.1)]!
    const reP90 = reSorted[Math.floor(reSorted.length * 0.9)]!

    console.log(`\nRerank relevance distribution (top-1):`)
    console.log(`  Average:  ${reAvg.toFixed(4)}`)
    console.log(`  Median:   ${reMedian.toFixed(4)}`)
    console.log(`  P10:      ${reP10.toFixed(4)} (weakest 10%)`)
    console.log(`  P90:      ${reP90.toFixed(4)} (strongest 10%)`)
    console.log(`  Min:      ${reSorted[0]!.toFixed(4)}`)
    console.log(`  Max:      ${reSorted[reSorted.length - 1]!.toFixed(4)}`)

    const avgLatency =
      rerankLatencies.reduce((a, b) => a + b, 0) / rerankLatencies.length
    console.log(`\nRerank stats:`)
    console.log(`  Model:        ${RERANK_MODEL}`)
    console.log(
      `  Over-fetch:   ${fetchK} → ${RERANK_TOP} (${OVERFETCH_MULTIPLIER}x)`
    )
    console.log(
      `  Success:      ${rerankSuccessCount}/${userQueries.length} queries`
    )
    console.log(`  Avg latency:  ${avgLatency.toFixed(0)}ms`)
  }

  console.log(`\nPer persona:`)
  for (const [persona, ps] of Object.entries(personaStats).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const reTag = RERANK
      ? ` | avg re: ${(ps.reScoreSum / ps.count).toFixed(4)}`
      : ''
    console.log(
      `  ${persona.padEnd(14)} ${ps.count} queries | avg sim: ${(ps.simSum / ps.count).toFixed(4)}${reTag}`
    )
  }

  console.log(`\nTotal queries: ${userQueries.length}`)
  console.log()

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})

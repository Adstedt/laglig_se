import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../lib/prisma'
import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'

async function main() {
  const openai = new OpenAI()

  // Targeted queries for our 5 embedded documents
  const queries = [
    // SFS 2005:559 — Aktiebolagsförordning (77 chunks)
    'registrering av nyemission av aktier hos Bolagsverket',
    'vilka handlingar krävs vid fusion av aktiebolag',
    'elektronisk underskrift vid anmälan till Bolagsverket',
    'vem får underteckna registreringsanmälan för aktiebolag',
    // SFS 1971:1016 — Gränsälvskommissionen (15 chunks)
    'finsk-svenska gränsälvskommissionens kansli och personal',
    'sekretess i gränsälvskommissionen',
    // SFS 1983:1079 — Ungdomslag (15 chunks)
    'statsbidrag för ungdomar som startar egen rörelse',
    'dubbelfinansiering av statsbidrag',
    // SFS 1989:10 — Rederinämnden (12 chunks)
    'Rederinämndens uppgifter och sjöfartsstöd',
    'överklagande av Rederinämndens beslut',
    // SFS 2007:758 — Fortifikationsverket (17 chunks)
    'Fortifikationsverkets förvaltning av försvarets fastigheter',
  ]

  for (const query of queries) {
    const embResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    })
    const queryVec = `[${embResponse.data[0]!.embedding.join(',')}]`

    const results = await prisma.$queryRaw<
      Array<{
        path: string
        contextual_header: string
        content: string
        context_prefix: string | null
        similarity: number
        document_number: string
      }>
    >`
      SELECT cc.path, cc.contextual_header,
             LEFT(cc.content, 150) as content,
             LEFT(cc.context_prefix, 200) as context_prefix,
             1 - (cc.embedding <=> ${queryVec}::vector) as similarity,
             ld.document_number
      FROM content_chunks cc
      JOIN legal_documents ld ON cc.source_id = ld.id
      WHERE cc.embedding IS NOT NULL
      ORDER BY cc.embedding <=> ${queryVec}::vector
      LIMIT 3
    `

    console.log(`\nQuery: "${query}"`)
    console.log('-'.repeat(70))
    for (const r of results) {
      console.log(
        `  [${r.similarity.toFixed(4)}] ${r.document_number} | ${r.path}`
      )
      console.log(`    Header:  ${r.contextual_header.substring(0, 100)}`)
      if (r.context_prefix) {
        console.log(`    Prefix:  ${r.context_prefix}`)
      }
      console.log(`    Content: ${r.content}...`)
    }
  }

  await prisma.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})

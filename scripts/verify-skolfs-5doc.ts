/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { prisma } from '../lib/prisma'
/* eslint-enable import/first */

const DOCS = [
  'SKOLFS 1994:48',
  'SKOLFS 1992:40',
  'SKOLFS 1991:39',
  'SKOLFS 2026:8',
  'SKOLFS 2011:144',
  'SKOLFS 1994:48',
  'SKOLFS 2022:417',
  'SKOLFS 2023:184',
]

async function main() {
  for (const dn of DOCS) {
    const d = await prisma.legalDocument.findUnique({
      where: { document_number: dn },
      select: {
        id: true,
        slug: true,
        content_type: true,
        status: true,
        regulatory_body: true,
        agency_prefix: true,
        full_text: true,
        html_content: true,
        metadata: true,
      },
    })
    if (!d) {
      console.log(`\n${dn}: ❌ NOT IN DB`)
      continue
    }
    const chunks = await prisma.contentChunk.count({
      where: { source_id: d.id },
    })
    const withEmb = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT count(*)::bigint c FROM content_chunks
      WHERE source_id = ${d.id} AND embedding IS NOT NULL`
    const withPfx = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT count(*)::bigint c FROM content_chunks
      WHERE source_id = ${d.id} AND context_prefix IS NOT NULL`
    const fts = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT count(*)::bigint c FROM legal_documents
      WHERE id = ${d.id} AND search_vector IS NOT NULL`
    const meta = (d.metadata as Record<string, unknown>) ?? {}
    const skolfs = (meta.skolfs as Record<string, unknown>) ?? {}
    console.log(`\n${dn}  [${d.content_type}/${d.status}]  slug=${d.slug}`)
    console.log(
      `  regulatory_body=${d.regulatory_body}  agency_prefix=${d.agency_prefix}`
    )
    console.log(
      `  chunks=${chunks}  embeddings=${Number(withEmb[0]!.c)}  prefixes=${Number(withPfx[0]!.c)}  search_vector=${Number(fts[0]!.c) === 1 ? 'set' : 'MISSING'}`
    )
    console.log(
      `  full_text=${(d.full_text?.length ?? 0).toLocaleString()} chars  html=${(d.html_content?.length ?? 0).toLocaleString()} chars`
    )
    console.log(
      `  baseline: contentHash=${typeof meta.contentHash === 'string' ? (meta.contentHash as string).slice(0, 10) : 'MISSING'}  validity=${skolfs.validity}  isConsolidated=${skolfs.isConsolidated}  amendments=${Array.isArray(skolfs.amendmentChain) ? skolfs.amendmentChain.length : '?'}  upcoming=${Array.isArray(skolfs.upcoming) ? skolfs.upcoming.length : '?'}`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())

/* eslint-disable no-console */
/** Fast aggregate scan: existing docs whose chunk tokens cover <60% of body. */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
import { prisma } from '../lib/prisma'

async function main() {
  // token estimate ≈ chars/4; "long" = >1600 chars (~400 tok)
  const rows = await prisma.$queryRaw<
    { content_type: string; affected: bigint; total_long: bigint }[]
  >`
    SELECT ld.content_type::text,
           count(*) FILTER (
             WHERE t.chunk_tokens < 0.6 * (length(ld.full_text)/4.0)
           )::bigint affected,
           count(*)::bigint total_long
    FROM legal_documents ld
    JOIN LATERAL (
      SELECT coalesce(sum(cc.token_count),0) chunk_tokens
      FROM content_chunks cc WHERE cc.source_id = ld.id
    ) t ON true
    WHERE ld.content_type IN ('AGENCY_REGULATION','SFS_LAW')
      AND ld.html_content IS NOT NULL
      AND length(ld.full_text) > 1600
    GROUP BY ld.content_type`
  console.log('Low-coverage (long) docs needing re-chunk:')
  let total = 0
  for (const r of rows) {
    console.log(
      `  ${r.content_type}: ${Number(r.affected)} affected / ${Number(r.total_long)} long docs`
    )
    total += Number(r.affected)
  }
  console.log(`  TOTAL affected: ${total}`)
}
main()
  .catch(console.error)
  .finally(() => void prisma.$disconnect())

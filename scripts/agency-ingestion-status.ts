/* eslint-disable no-console */
/**
 * Generates docs/agency-ingestion-status.md — the directory of which myndigheter
 * (agency författningssamlingar) we've ingested, derived from the catalog (the
 * source of truth). Re-run after any agency ingestion to refresh.
 *
 * Usage: pnpm tsx scripts/agency-ingestion-status.ts [--date YYYY-MM-DD]
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { writeFileSync } from 'fs'
import { prisma } from '../lib/prisma'
/* eslint-enable import/first */

const OUT = resolve(process.cwd(), 'docs/agency-ingestion-status.md')

// Curated ingestion-method / story per prefix (product knowledge, not in the DB).
const METHOD: Record<string, string> = {
  AFS: 'Consolidated PDF (av.se) · Story 9.1',
  MSBFS: 'Agency PDF · Story 9.2',
  NFS: 'Agency PDF · Story 9.2',
  'ELSÄK-FS': 'Agency PDF · Story 9.3',
  BFS: 'Agency PDF · Story 9.3',
  SSMFS: 'Agency PDF · Story 9.3',
  KIFS: 'Agency PDF · Story 9.3',
  SRVFS: 'Agency PDF · Story 9.3',
  SKVFS: 'Agency PDF · Story 9.3',
  'SCB-FS': 'Agency PDF · Story 9.3',
  STAFS: 'Agency PDF · Story 9.3',
  SOSFS: 'Consolidated HTML (socialstyrelsen.se) · Story 9.5',
  'HSLF-FS': 'Consolidated HTML (socialstyrelsen.se) · Story 9.5',
}

async function main() {
  const dateArg = process.argv.indexOf('--date')
  const date =
    dateArg !== -1 && process.argv[dateArg + 1]
      ? process.argv[dateArg + 1]!
      : new Date().toISOString().slice(0, 10)

  const rows = await prisma.legalDocument.findMany({
    where: { content_type: 'AGENCY_REGULATION' },
    select: { agency_prefix: true, regulatory_body: true, html_content: true },
  })

  type Agg = { bodies: Set<string>; total: number; withContent: number }
  const byPrefix = new Map<string, Agg>()
  for (const r of rows) {
    const k = r.agency_prefix ?? '(unattributed)'
    const e = byPrefix.get(k) ?? { bodies: new Set(), total: 0, withContent: 0 }
    e.total++
    if (r.html_content) e.withContent++
    if (r.regulatory_body) e.bodies.add(r.regulatory_body)
    byPrefix.set(k, e)
  }

  const entries = [...byPrefix.entries()].sort(
    (a, b) => b[1].withContent - a[1].withContent
  )
  const totalWith = rows.filter((r) => r.html_content).length

  const lines: string[] = []
  lines.push('# Agency föreskrifter — ingestion directory')
  lines.push('')
  lines.push(
    `> **Generated** from the catalog by \`scripts/agency-ingestion-status.ts\` — do not hand-edit. Re-run after any agency ingestion.`
  )
  lines.push(
    `> Last generated: ${date} · **${totalWith} ingested docs** across ${entries.filter((e) => e[0] !== '(unattributed)').length} agencies.`
  )
  lines.push('')
  lines.push(
    '| Prefix | Issuing authority | Ingested (with content / total) | Ingestion method |'
  )
  lines.push(
    '|--------|-------------------|----------------------------------|------------------|'
  )
  for (const [prefix, e] of entries) {
    const body = [...e.bodies].join(' / ') || '—'
    const counts =
      e.withContent === e.total
        ? `${e.withContent}`
        : `${e.withContent} / ${e.total}`
    lines.push(
      `| \`${prefix}\` | ${body} | ${counts} | ${METHOD[prefix] ?? '—'} |`
    )
  }
  lines.push('')
  lines.push('## Notes')
  lines.push('')
  lines.push(
    '- **Ingested = `content_type: AGENCY_REGULATION`** rows in `LegalDocument`. "with content" = has `html_content` (a few are metadata-only stubs).'
  )
  lines.push(
    '- **`HSLF-FS`** is a shared series — most docs are Socialstyrelsen-issued; co-signatory issuers (e.g. Rättsmedicinalverket) are attributed per-document via `regulatory_body`. **`SOSFS`** is Socialstyrelsen-only by definition.'
  )
  const unattributed = byPrefix.get('(unattributed)')
  if (unattributed) {
    lines.push(
      `- **${unattributed.total} unattributed** rows have no \`agency_prefix\`/\`regulatory_body\` mapping (prefix not in \`lib/agency/regulatory-bodies.ts\`). Add the prefix→authority mapping + re-run the attribution backfill.`
    )
  }
  lines.push(
    '- Attribution map: `lib/agency/regulatory-bodies.ts`. Socialstyrelsen issuer detail: `data/socialstyrelsen-issuers.json`.'
  )

  writeFileSync(OUT, lines.join('\n') + '\n')
  console.log(`✓ Wrote ${OUT}`)
  console.log(lines.slice(5).join('\n'))
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

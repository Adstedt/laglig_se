/* eslint-disable no-console */
/**
 * Story 9.5 — enrichment: APPLY the resolved issuing agency to ingested rows.
 *
 * Issuers are determined once (authoritatively, LLM-over-body) by
 * scripts/resolve-socialstyrelsen-issuers.ts → data/socialstyrelsen-issuers.json.
 * This script just applies that map to the DB: sets `regulatory_body` = real issuer,
 * keeps `metadata.consolidating_authority = "Socialstyrelsen"` + an audit trail.
 * Most rows stay Socialstyrelsen; the co-signatory docs (Rättsmedicinalverket,
 * Läkemedelsverket) get corrected.
 *
 * Run AFTER the ingest completes. Usage: [--dry-run]
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { readFileSync } from 'fs'
import { prisma } from '../lib/prisma'
/* eslint-enable import/first */

const ISSUERS = resolve(process.cwd(), 'data/socialstyrelsen-issuers.json')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const issuers: Record<string, { issuer: string; source: string }> =
    JSON.parse(readFileSync(ISSUERS, 'utf8'))

  const rows = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      agency_prefix: { in: ['SOSFS', 'HSLF-FS'] },
    },
    select: {
      id: true,
      document_number: true,
      regulatory_body: true,
      metadata: true,
    },
  })
  console.log(
    `Ingested Socialstyrelsen-hosted rows: ${rows.length}${dryRun ? ' (dry-run)' : ''}\n`
  )

  let confirmed = 0
  let corrected = 0
  let missing = 0
  const changes: string[] = []

  for (const r of rows) {
    const resolved = issuers[r.document_number]
    if (!resolved || resolved.issuer === '(unresolved)') {
      missing++
      changes.push(
        `  ? ${r.document_number} — not in issuers.json (re-run resolve script)`
      )
      continue
    }
    const issuer = resolved.issuer
    if (issuer === 'Socialstyrelsen') confirmed++
    else {
      corrected++
      changes.push(`  → ${r.document_number}: ${r.regulatory_body} ⇒ ${issuer}`)
    }

    if (!dryRun) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      await prisma.legalDocument.update({
        where: { id: r.id },
        data: {
          regulatory_body: issuer,
          metadata: {
            ...meta,
            consolidating_authority: 'Socialstyrelsen',
            issuing_agency: issuer,
            issuer_resolved_from: resolved.source,
          } as object,
        },
      })
    }
  }

  console.log(`Confirmed Socialstyrelsen:        ${confirmed}`)
  console.log(`Corrected to co-signatory issuer: ${corrected}`)
  if (missing) console.log(`Missing from issuers.json:        ${missing}`)
  if (changes.length) console.log('\n' + changes.join('\n'))
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

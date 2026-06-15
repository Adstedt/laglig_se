/* eslint-disable no-console */
/**
 * Story 9.5 — Task 1: backfill `regulatory_body` + `agency_prefix` on existing
 * AGENCY_REGULATION rows (AFS/MSBFS/NFS/ELSÄK-FS/… + the SOSFS 2011:9 test row).
 *
 * Derives both fields from `document_number` via the shared attribution helper.
 * Idempotent: only updates rows whose derived values differ from what's stored.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-agency-attribution.ts            # apply
 *   pnpm tsx scripts/backfill-agency-attribution.ts --dry-run  # report only
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
/* eslint-disable import/first */
import { prisma } from '../lib/prisma'
import { deriveAgencyAttribution } from '../lib/agency/regulatory-bodies'
/* eslint-enable import/first */

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const rows = await prisma.legalDocument.findMany({
    where: { content_type: 'AGENCY_REGULATION' },
    select: {
      id: true,
      document_number: true,
      regulatory_body: true,
      agency_prefix: true,
    },
  })

  console.log(
    `AGENCY_REGULATION rows: ${rows.length}${dryRun ? ' (dry-run)' : ''}`
  )

  let updated = 0
  let alreadySet = 0
  const unmatched: string[] = []
  const byBody = new Map<string, number>()

  for (const r of rows) {
    const { agencyPrefix, regulatoryBody } = deriveAgencyAttribution(
      r.document_number
    )

    if (!regulatoryBody) {
      unmatched.push(r.document_number)
      continue
    }
    byBody.set(regulatoryBody, (byBody.get(regulatoryBody) ?? 0) + 1)

    const needsUpdate =
      r.regulatory_body !== regulatoryBody || r.agency_prefix !== agencyPrefix
    if (!needsUpdate) {
      alreadySet++
      continue
    }
    if (!dryRun) {
      await prisma.legalDocument.update({
        where: { id: r.id },
        data: { regulatory_body: regulatoryBody, agency_prefix: agencyPrefix },
      })
    }
    updated++
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'}: ${updated}`)
  console.log(`Already correct: ${alreadySet}`)
  console.log(
    `Unmatched (no body for prefix — left untouched): ${unmatched.length}`
  )
  if (unmatched.length)
    console.log(
      `  ${[...new Set(unmatched.map((d) => d.split(/\s/)[0]))].join(', ')}`
    )
  console.log(`\nBy regulatory_body:`)
  for (const [b, n] of [...byBody.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${b}: ${n}`)
  }
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

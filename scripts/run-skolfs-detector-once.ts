/**
 * One-off SKOLFS detector runner (Story 9.8, Task 4 verification).
 *
 * Invokes the shared detector core against the LIVE Skolverket API + the
 * configured database. Defaults to a DRY-RUN preview (classify + counts, ZERO
 * writes). Pass `--commit` to actually emit ChangeEvents (the first run also
 * backfills the ~18 July-2026 UPCOMING amendments) — a real data side-effect.
 *
 * Usage:
 *   pnpm tsx scripts/run-skolfs-detector-once.ts            # dry-run preview
 *   pnpm tsx scripts/run-skolfs-detector-once.ts --commit   # writes events
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { runSkolfsDetector } from '../lib/agency/skolfs-detector'

// Prisma reads DATABASE_URL lazily (first query), so loading .env.local at
// module-eval time — before main()'s first query — is sufficient.
loadEnv({ path: resolve(process.cwd(), '.env.local') })

async function main(): Promise<void> {
  const commit = process.argv.includes('--commit')

  console.log('='.repeat(64))
  console.log(
    `SKOLFS detector — ${commit ? 'COMMIT (writes ChangeEvents)' : 'DRY-RUN (no writes)'}`
  )
  console.log('='.repeat(64))

  const stats = await runSkolfsDetector({ commit })

  console.log(`\nfirstRun:        ${stats.firstRun}`)
  console.log(`polled bases:    ${stats.polled}`)
  console.log(`our baselines:   ${stats.baselines}`)
  console.log(`signals total:   ${stats.signalsTotal}`)
  console.log(
    `  NEW_LAW:       ${stats.newLaw}  (silent-ingest, out-of-band; no event)`
  )
  console.log(`  AMENDMENT:     ${stats.amendment}`)
  console.log(`  REPEAL:        ${stats.repeal}`)
  console.log(`  UPCOMING:      ${stats.upcoming}`)
  if (commit) {
    console.log(`\nevents created:  ${stats.eventsCreated}`)
    console.log(`events dup:      ${stats.eventsDuplicate}`)
    console.log(`events failed:   ${stats.eventsFailed}`)
  }

  console.log(`\nsample signals (first ${stats.sample.length}):`)
  for (const s of stats.sample) {
    console.log(`  [${s.kind}] ${s.documentNumber} — ${s.reason}`)
  }

  if (!commit) {
    console.log(
      `\nDRY-RUN — nothing written. Re-run with --commit to emit these events.`
    )
  }
  console.log('='.repeat(64))
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})

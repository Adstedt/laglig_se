/* eslint-disable no-console */
/**
 * Backfill SFS Instrument (Story 2.32)
 *
 * Classifies every existing SFS_LAW and SFS_AMENDMENT document by its title
 * and writes the result to the new `sfs_instrument` column. Idempotent:
 * skips rows whose current value already matches the inferred value.
 *
 * Forward population at ingest is handled by the various sync write paths
 * (see Story 2.32 Task 3); this script catches up history.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-sfs-instrument.ts            # apply changes
 *   pnpm tsx scripts/backfill-sfs-instrument.ts --dry-run  # report only
 */
import { prisma } from '../lib/prisma'
import { ContentType, SfsInstrument } from '@prisma/client'
import { inferSfsInstrument } from '../lib/sfs/instrument'

const BATCH_SIZE = 1000
const DRY_RUN = process.argv.includes('--dry-run')

interface RowSlim {
  id: string
  title: string
  sfs_instrument: SfsInstrument
}

async function backfill(): Promise<void> {
  const startedAt = Date.now()
  let cursor: string | undefined
  let processed = 0
  let changed = 0
  let skipped = 0

  console.log(
    `[backfill-sfs-instrument] start (batch=${BATCH_SIZE}, dryRun=${DRY_RUN})`
  )

  // Cursor pagination over SFS_LAW + SFS_AMENDMENT rows, ordered by id.
  // findMany with `take` + `cursor` + `skip:1` is the canonical Prisma pattern
  // for streaming large tables without OFFSET pagination's quadratic cost.
  for (;;) {
    const batch: RowSlim[] = await prisma.legalDocument.findMany({
      where: {
        content_type: {
          in: [ContentType.SFS_LAW, ContentType.SFS_AMENDMENT],
        },
      },
      select: { id: true, title: true, sfs_instrument: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    if (batch.length === 0) break

    // Classify locally, only update when value would change
    const updates: { id: string; instrument: SfsInstrument }[] = []
    for (const row of batch) {
      const inferred = inferSfsInstrument(row.title)
      if (inferred !== row.sfs_instrument) {
        updates.push({ id: row.id, instrument: inferred })
      } else {
        skipped++
      }
    }

    if (updates.length > 0 && !DRY_RUN) {
      // Group by target instrument to use updateMany (one statement per group)
      const byInstrument = new Map<SfsInstrument, string[]>()
      for (const u of updates) {
        const list = byInstrument.get(u.instrument) ?? []
        list.push(u.id)
        byInstrument.set(u.instrument, list)
      }
      await prisma.$transaction(
        Array.from(byInstrument.entries()).map(([instrument, ids]) =>
          prisma.legalDocument.updateMany({
            where: { id: { in: ids } },
            data: { sfs_instrument: instrument },
          })
        )
      )
    }

    processed += batch.length
    changed += updates.length
    cursor = batch[batch.length - 1]?.id

    console.log(
      `  processed=${processed} changed=${changed} skipped=${skipped}`
    )
  }

  console.log(
    `\n[backfill-sfs-instrument] done in ${Math.round(
      (Date.now() - startedAt) / 1000
    )}s — processed=${processed} changed=${changed} skipped=${skipped}${
      DRY_RUN ? ' (DRY RUN — no writes)' : ''
    }`
  )

  // Final distribution
  const distribution = await prisma.legalDocument.groupBy({
    by: ['content_type', 'sfs_instrument'],
    where: {
      content_type: {
        in: [ContentType.SFS_LAW, ContentType.SFS_AMENDMENT],
      },
    },
    _count: { _all: true },
    orderBy: [{ content_type: 'asc' }, { sfs_instrument: 'asc' }],
  })

  console.log('\nDistribution after backfill:')
  console.log('  content_type        sfs_instrument   count')
  console.log('  ------------------- ---------------- --------')
  for (const r of distribution) {
    console.log(
      `  ${r.content_type.padEnd(19)} ${r.sfs_instrument.padEnd(16)} ${String(
        r._count._all
      ).padStart(7)}`
    )
  }
}

backfill()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('[backfill-sfs-instrument] FAILED:', err)
    return prisma.$disconnect().then(() => process.exit(1))
  })

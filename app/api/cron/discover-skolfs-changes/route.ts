/**
 * SKOLFS amendment detector cron (Story 9.8).
 *
 * Daily state-diff over the Skolverket API: ONE `GET /api/statute?size=20000`
 * poll → project each base to a current snapshot → diff against the per-doc
 * baseline captured by Story 9.7 (`metadata.skolfs`) → classify into
 * {NEW_LAW, AMENDMENT, REPEAL, UPCOMING_AMENDMENT}. The classified signals drive
 * re-ingest + `ChangeEvent` emission (Tasks 2/3); the downstream
 * notify/assessment pipeline is reused unchanged (source-agnostic).
 *
 * Task 1 (this commit): auth guard, poll, projection, baseline load,
 * classification, and `CronJobRun` logging of the breakdown. Re-ingest and
 * event emission land in Tasks 2/3.
 *
 * [Source: Story 9.8 AC 1-5; app/api/cron/discover-sfs-amendments (auth/log pattern)]
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import {
  fetchSkolfsStatute,
  buildCurrentSnapshots,
} from '@/lib/agency/skolfs-api'
import {
  classifySkolfsDiff,
  snapshotFromBaselineMetadata,
  type SkolfsSnapshot,
  type SkolfsSignal,
} from '@/lib/agency/skolfs-change-detection'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET
const JOB_NAME = 'discover-skolfs-changes'

interface DetectorStats {
  polled: number
  baselines: number
  firstRun: boolean
  newLaw: number
  amendment: number
  repeal: number
  upcoming: number
  signalsTotal: number
  duration: string
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth — mirror the SFS cron guard (AC 1).
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined
  try {
    runId = await startJobRun(JOB_NAME, triggeredBy)
  } catch {
    console.error(`[${JOB_NAME}] Failed to start job run logging`)
  }

  const stats: DetectorStats = {
    polled: 0,
    baselines: 0,
    firstRun: false,
    newLaw: 0,
    amendment: 0,
    repeal: 0,
    upcoming: 0,
    signalsTotal: 0,
    duration: '0s',
  }

  try {
    // First detector run? → backfill UPCOMING events from the 9.7 baseline (AC 2).
    const priorSuccess = await prisma.cronJobRun.count({
      where: { job_name: JOB_NAME, status: 'SUCCESS' },
    })
    const firstRun = priorSuccess === 0
    stats.firstRun = firstRun

    // 1. ONE statute poll → current per-base snapshots.
    const hits = await fetchSkolfsStatute()
    const current = buildCurrentSnapshots(hits)
    stats.polled = current.size
    console.log(
      `[${JOB_NAME}] polled ${hits.length} hits → ${current.size} bases`
    )

    // 2. Load our SKOLFS baselines (Story 9.7 rows).
    const ourDocs = await prisma.legalDocument.findMany({
      where: {
        content_type: ContentType.AGENCY_REGULATION,
        agency_prefix: 'SKOLFS',
      },
      select: { id: true, document_number: true, status: true, metadata: true },
    })
    stats.baselines = ourDocs.length
    const baselineByNumber = new Map(ourDocs.map((d) => [d.document_number, d]))

    // 3. Classify every current base against its baseline.
    const allSignals: SkolfsSignal[] = []
    for (const [docNumber, currentSnap] of current) {
      const known = baselineByNumber.get(docNumber)
      const baseline = known
        ? (snapshotFromBaselineMetadata(docNumber, known.metadata) ??
          fallbackBaseline(docNumber, currentSnap, known.status))
        : null
      const signals = classifySkolfsDiff(baseline, currentSnap, { firstRun })
      allSignals.push(...signals)
    }

    for (const s of allSignals) {
      if (s.kind === 'NEW_LAW') stats.newLaw++
      else if (s.kind === 'AMENDMENT') stats.amendment++
      else if (s.kind === 'REPEAL') stats.repeal++
      else if (s.kind === 'UPCOMING_AMENDMENT') stats.upcoming++
    }
    stats.signalsTotal = allSignals.length

    console.log(
      `[${JOB_NAME}] signals — new:${stats.newLaw} amend:${stats.amendment} ` +
        `repeal:${stats.repeal} upcoming:${stats.upcoming} (firstRun=${firstRun})`
    )

    // TODO(Task 2): content-hash guard + re-ingest + emit ChangeEvent(AMENDMENT/NEW_LAW).
    // TODO(Task 3): REPEAL status flip + UPCOMING_AMENDMENT emission (needs migration).

    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.signalsTotal,
        itemsFailed: 0,
        metadata: { ...stats },
      })
    }
    return NextResponse.json({ success: true, stats })
  } catch (error) {
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    console.error(`[${JOB_NAME}] failed:`, error)
    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }
    return NextResponse.json(
      { success: false, error: String(error), stats },
      { status: 500 }
    )
  }
}

/**
 * Defensive baseline for a doc we have but whose `metadata.skolfs` block is
 * missing/malformed — prevents a false NEW_LAW and still allows REPEAL /
 * AMENDMENT detection. Derives validity from the stored status.
 */
function fallbackBaseline(
  documentNumber: string,
  current: SkolfsSnapshot,
  status: string
): SkolfsSnapshot {
  return {
    documentNumber,
    validity: status === 'REPEALED' ? 'EXPIRED' : 'VALID',
    isConsolidated: current.isConsolidated,
    latestChangeBySkolfsNo: null,
    effectiveDate: null,
    amendmentChain: [],
    upcoming: [],
  }
}

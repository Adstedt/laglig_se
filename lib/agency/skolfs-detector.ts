/**
 * SKOLFS detector core (Story 9.8) — shared by the cron route and the one-off
 * runner script so there is a single detection code path.
 *
 * `runSkolfsDetector({ commit })`:
 *  - poll `/api/statute` once → project per-base current snapshots
 *  - load the per-doc baselines (Story 9.7 `metadata.skolfs`)
 *  - classify each base into NEW_LAW / AMENDMENT / REPEAL / UPCOMING_AMENDMENT
 *  - when `commit`: enrich the amendment-bearing signals + emit dedup'd
 *    ChangeEvents (REPEAL also flips status → REPEALED). When NOT `commit`
 *    (dry-run) it classifies + counts only, writing nothing — a safe preview.
 *
 * [Source: Story 9.8 AC 1-5, 9]
 */

import { prisma } from '@/lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'
import {
  fetchSkolfsStatute,
  buildCurrentSnapshots,
  fetchAmendmentDetails,
} from './skolfs-api'
import {
  classifySkolfsDiff,
  snapshotFromBaselineMetadata,
  enrichSignal,
  type SkolfsSnapshot,
  type SkolfsSignal,
} from './skolfs-change-detection'
import { emitSkolfsChangeEvent } from './skolfs-events'

const JOB_NAME = 'discover-skolfs-changes'

export interface RunSkolfsDetectorOptions {
  /** false = dry-run preview (classify + count, ZERO writes). */
  commit: boolean
  /** override first-run detection (default: zero prior SUCCESS CronJobRun rows). */
  firstRun?: boolean
  /** wall-clock budget; emission stops this long before it to drain next run. */
  maxRuntimeMs?: number
  startTime?: number
  fetchImpl?: typeof fetch
}

export interface SkolfsDetectorStats {
  polled: number
  baselines: number
  firstRun: boolean
  committed: boolean
  newLaw: number
  amendment: number
  repeal: number
  upcoming: number
  signalsTotal: number
  eventsCreated: number
  eventsDuplicate: number
  eventsFailed: number
  /** a small sample of classified signals (for dry-run visibility / logs). */
  sample: { kind: string; documentNumber: string; reason: string }[]
}

export async function runSkolfsDetector(
  opts: RunSkolfsDetectorOptions
): Promise<SkolfsDetectorStats> {
  const startTime = opts.startTime ?? Date.now()
  const maxRuntimeMs = opts.maxRuntimeMs ?? Number.POSITIVE_INFINITY
  const fetchImpl = opts.fetchImpl ?? fetch

  const firstRun =
    opts.firstRun ??
    (await prisma.cronJobRun.count({
      where: { job_name: JOB_NAME, status: 'SUCCESS' },
    })) === 0

  const stats: SkolfsDetectorStats = {
    polled: 0,
    baselines: 0,
    firstRun,
    committed: opts.commit,
    newLaw: 0,
    amendment: 0,
    repeal: 0,
    upcoming: 0,
    signalsTotal: 0,
    eventsCreated: 0,
    eventsDuplicate: 0,
    eventsFailed: 0,
    sample: [],
  }

  // 1. ONE statute poll → current per-base snapshots.
  const hits = await fetchSkolfsStatute(fetchImpl)
  const current = buildCurrentSnapshots(hits)
  stats.polled = current.size

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

  // 3. Classify each current base against its baseline.
  interface CarriedSignal {
    signal: SkolfsSignal
    snap: SkolfsSnapshot
    docId: string | null
  }
  const carried: CarriedSignal[] = []
  for (const [docNumber, snap] of current) {
    const known = baselineByNumber.get(docNumber)
    const baseline = known
      ? (snapshotFromBaselineMetadata(docNumber, known.metadata) ??
        fallbackBaseline(docNumber, snap, known.status))
      : null
    for (const signal of classifySkolfsDiff(baseline, snap, { firstRun })) {
      carried.push({ signal, snap, docId: known?.id ?? null })
    }
  }

  for (const { signal: s } of carried) {
    if (s.kind === 'NEW_LAW') stats.newLaw++
    else if (s.kind === 'AMENDMENT') stats.amendment++
    else if (s.kind === 'REPEAL') stats.repeal++
    else if (s.kind === 'UPCOMING_AMENDMENT') stats.upcoming++
  }
  stats.signalsTotal = carried.length
  stats.sample = carried.slice(0, 25).map(({ signal }) => ({
    kind: signal.kind,
    documentNumber: signal.documentNumber,
    reason: signal.reason,
  }))

  // 4. Emit (commit only). NEW_LAW is silent-ingest (no doc row → out-of-band).
  if (opts.commit) {
    for (const { signal, snap, docId } of carried) {
      if (!docId || signal.kind === 'NEW_LAW') continue
      if (Date.now() - startTime > maxRuntimeMs) break
      try {
        let enriched = signal
        if (
          (signal.kind === 'AMENDMENT' ||
            signal.kind === 'UPCOMING_AMENDMENT') &&
          snap.documentType &&
          signal.amendmentSkolfsNo
        ) {
          const details = await fetchAmendmentDetails(
            snap.documentType,
            snap.documentNumber.replace(/^SKOLFS\s+/, ''),
            fetchImpl
          )
          const detail = details.get(signal.amendmentSkolfsNo)
          if (detail) enriched = enrichSignal(signal, detail)
        }
        if (signal.kind === 'REPEAL') {
          await prisma.legalDocument.update({
            where: { id: docId },
            data: { status: DocumentStatus.REPEALED },
          })
        }
        const result = await emitSkolfsChangeEvent(docId, enriched)
        if (result.status === 'created') stats.eventsCreated++
        else if (result.status === 'duplicate') stats.eventsDuplicate++
      } catch (err) {
        stats.eventsFailed++
        console.error(
          `[${JOB_NAME}] emit failed for ${signal.documentNumber} (${signal.kind}):`,
          err
        )
      }
    }
  }

  return stats
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

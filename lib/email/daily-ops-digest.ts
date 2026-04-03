/* eslint-disable no-console */
/**
 * Daily Ops Monitoring Digest
 *
 * Gathers pipeline health data, detects SFS gaps, and builds an HTML email
 * summarizing all cron job activity for the last 24 hours.
 */

import { prisma } from '@/lib/prisma'
import { ContentType, ParseStatus } from '@prisma/client'
import { discoverFromIndex } from '@/lib/sfs/sfs-amendment-crawler'
import { JOB_REGISTRY } from '@/lib/admin/job-registry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionSummary {
  amendments: number
  newLaws: number
  changeEvents: number
  summariesGenerated: number
  sfsRange: { min: string | null; max: string | null }
  /** Chunk processing stats (Story 14.14) */
  chunksCreated: number
  docsNeedingChunks: number
  /** Amendment summary stats (Story 8.8) */
  summariesGenerated24h: number
  amendmentsNeedingSummary: number
}

export interface GapDetectionResult {
  year: number
  indexCount: number
  dbCount: number
  missing: string[]
  error?: string
}

export interface JobHealthEntry {
  name: string
  displayName: string
  lastRunAt: Date | null
  status: string | null
  durationMs: number | null
  itemsProcessed: number | null
  itemsFailed: number | null
  isStale: boolean
  schedule: string
}

export interface NotificationBacklog {
  unnotifiedCount: number
  oldestDate: Date | null
}

export interface AmendmentPipelineStatus {
  byStatus: Record<string, number>
  topFailures: Array<{ sfsNumber: string; error: string }>
}

export interface ChunkHealthStatus {
  totalChunks: number
  withPrefix: number
  withoutPrefix: number
  withEmbedding: number
  withoutEmbedding: number
  chunksCreated24h: number
  docsNeedingChunks: number
  stuckDocs: Array<{ documentNumber: string; updatedAt: Date }>
}

export interface DigestData {
  ingestion: IngestionSummary | null
  gaps: GapDetectionResult | null
  jobHealth: JobHealthEntry[]
  backlog: NotificationBacklog | null
  pipeline: AmendmentPipelineStatus | null
  chunkHealth: ChunkHealthStatus | null
}

// ---------------------------------------------------------------------------
// Data Gathering
// ---------------------------------------------------------------------------

export async function gatherIngestionSummary(
  cutoff: Date
): Promise<IngestionSummary> {
  const [
    amendments,
    newLaws,
    changeEvents,
    summaries,
    sfsRange,
    chunksCreated,
    docsNeedingChunks,
    summariesGenerated24h,
    amendmentsNeedingSummary,
  ] = await Promise.all([
    prisma.amendmentDocument.count({
      where: { created_at: { gte: cutoff } },
    }),
    prisma.legalDocument.count({
      where: {
        content_type: ContentType.SFS_LAW,
        created_at: { gte: cutoff },
      },
    }),
    prisma.changeEvent.count({
      where: { detected_at: { gte: cutoff } },
    }),
    prisma.changeEvent.count({
      where: {
        ai_summary_generated_at: { gte: cutoff },
        ai_summary: { not: null },
      },
    }),
    prisma.amendmentDocument.aggregate({
      where: { created_at: { gte: cutoff } },
      _min: { sfs_number: true },
      _max: { sfs_number: true },
    }),
    // Story 14.14: Chunks created in the last 24h
    prisma.contentChunk.count({
      where: {
        source_type: 'LEGAL_DOCUMENT',
        created_at: { gte: cutoff },
      },
    }),
    // Story 14.14: Documents still needing chunks
    prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM legal_documents ld
        LEFT JOIN (
          SELECT source_id, MAX(created_at) as max_chunk_created
          FROM content_chunks
          WHERE source_type = 'LEGAL_DOCUMENT'
          GROUP BY source_id
        ) cc ON cc.source_id = ld.id
        WHERE ld.content_type IN ('SFS_LAW', 'AGENCY_REGULATION')
          AND (ld.html_content IS NOT NULL OR ld.json_content IS NOT NULL OR ld.markdown_content IS NOT NULL)
          AND (cc.max_chunk_created IS NULL OR ld.updated_at > cc.max_chunk_created)
      `.then((rows) => Number(rows[0]?.count ?? 0)),
    // Story 8.8: Amendment summaries generated in the last 24h
    prisma.changeEvent.count({
      where: {
        ai_summary_generated_at: { gte: cutoff },
        ai_summary: { not: null },
      },
    }),
    // Story 8.8: Amendments still needing summaries
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT ce.amendment_sfs)::bigint as count
      FROM change_events ce
      JOIN amendment_documents ad ON ad.sfs_number = REPLACE(ce.amendment_sfs, 'SFS ', '')
      WHERE ce.ai_summary IS NULL
        AND ce.amendment_sfs IS NOT NULL
        AND ad.parse_status = 'COMPLETED'
        AND ad.markdown_content IS NOT NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
  ])

  return {
    amendments,
    newLaws,
    changeEvents,
    summariesGenerated: summaries,
    sfsRange: {
      min: sfsRange._min.sfs_number,
      max: sfsRange._max.sfs_number,
    },
    chunksCreated,
    docsNeedingChunks,
    summariesGenerated24h,
    amendmentsNeedingSummary,
  }
}

export async function gatherGapDetection(
  year: number
): Promise<GapDetectionResult> {
  try {
    // Scrape the full index (no watermark) to get ALL published SFS numbers
    const indexResult = await discoverFromIndex(year, {
      requestDelayMs: 200,
    })

    const indexSfsNumbers = new Set(
      indexResult.documents.map((d) => d.sfsNumber)
    )

    // Get all amendment_documents SFS numbers for the year
    const amendments = await prisma.amendmentDocument.findMany({
      where: { sfs_number: { startsWith: `${year}:` } },
      select: { sfs_number: true },
    })

    // Get all legal_documents document_numbers for the year (covers new laws)
    const legalDocs = await prisma.legalDocument.findMany({
      where: {
        document_number: { startsWith: `SFS ${year}:` },
      },
      select: { document_number: true },
    })

    const dbSfsNumbers = new Set<string>()
    for (const a of amendments) {
      dbSfsNumbers.add(a.sfs_number)
    }
    for (const d of legalDocs) {
      // "SFS 2026:123" -> "2026:123" (robust: handle missing space)
      const match = d.document_number.match(/(\d{4}:\d+)/)
      if (match?.[1]) {
        dbSfsNumbers.add(match[1])
      }
    }

    const missing = [...indexSfsNumbers].filter((sfs) => !dbSfsNumbers.has(sfs))
    missing.sort()

    return {
      year,
      indexCount: indexSfsNumbers.size,
      dbCount: dbSfsNumbers.size,
      missing,
    }
  } catch (error) {
    return {
      year,
      indexCount: 0,
      dbCount: 0,
      missing: [],
      error:
        error instanceof Error ? error.message : 'Gap detection unavailable',
    }
  }
}

export async function gatherJobHealth(): Promise<JobHealthEntry[]> {
  const entries: JobHealthEntry[] = []

  for (const job of JOB_REGISTRY.filter((j) => !j.disabled)) {
    const latestRun = await prisma.cronJobRun.findFirst({
      where: { job_name: job.name },
      orderBy: { started_at: 'desc' },
      select: {
        started_at: true,
        status: true,
        duration_ms: true,
        items_processed: true,
        items_failed: true,
      },
    })

    // Determine staleness: if no run in the last 26 hours for daily jobs,
    // or 8 days for weekly jobs
    let isStale = false
    if (latestRun?.started_at) {
      const hoursSince =
        (Date.now() - latestRun.started_at.getTime()) / (1000 * 60 * 60)
      const parts = job.schedule.split(' ')
      const dayOfWeek = parts[4]
      const isWeekly = dayOfWeek !== undefined && dayOfWeek !== '*'
      isStale = isWeekly ? hoursSince > 192 : hoursSince > 26
    } else {
      isStale = true
    }

    entries.push({
      name: job.name,
      displayName: job.displayName,
      lastRunAt: latestRun?.started_at ?? null,
      status: latestRun?.status ?? null,
      durationMs: latestRun?.duration_ms ?? null,
      itemsProcessed: latestRun?.items_processed ?? null,
      itemsFailed: latestRun?.items_failed ?? null,
      isStale,
      schedule: job.scheduleHuman,
    })
  }

  return entries
}

export async function gatherNotificationBacklog(): Promise<NotificationBacklog> {
  const [count, oldest] = await Promise.all([
    prisma.changeEvent.count({
      where: { notification_sent: false },
    }),
    prisma.changeEvent.findFirst({
      where: { notification_sent: false },
      orderBy: { detected_at: 'asc' },
      select: { detected_at: true },
    }),
  ])

  return {
    unnotifiedCount: count,
    oldestDate: oldest?.detected_at ?? null,
  }
}

export async function gatherAmendmentPipeline(
  year: number
): Promise<AmendmentPipelineStatus> {
  const statuses = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    where: { sfs_number: { startsWith: `${year}:` } },
    _count: true,
  })

  const byStatus: Record<string, number> = {}
  for (const s of statuses) {
    byStatus[s.parse_status] = s._count
  }

  const failures = await prisma.amendmentDocument.findMany({
    where: {
      sfs_number: { startsWith: `${year}:` },
      parse_status: ParseStatus.FAILED,
    },
    select: { sfs_number: true, parse_error: true },
    orderBy: { updated_at: 'desc' },
    take: 5,
  })

  return {
    byStatus,
    topFailures: failures.map((f) => ({
      sfsNumber: f.sfs_number,
      error: f.parse_error ?? 'Unknown error',
    })),
  }
}

export async function gatherChunkHealth(
  cutoff: Date
): Promise<ChunkHealthStatus> {
  const [totals, created24h, docsNeeding, stuckDocs] = await Promise.all([
    prisma.$queryRaw<
      [{ total: bigint; with_prefix: bigint; with_embedding: bigint }]
    >`
      SELECT
        COUNT(*)::bigint as total,
        COUNT(context_prefix)::bigint as with_prefix,
        COUNT(embedding)::bigint as with_embedding
      FROM content_chunks
      WHERE source_type = 'LEGAL_DOCUMENT'
    `,
    prisma.contentChunk.count({
      where: {
        source_type: 'LEGAL_DOCUMENT',
        created_at: { gte: cutoff },
      },
    }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM legal_documents ld
      LEFT JOIN (
        SELECT source_id, MAX(created_at) as max_chunk_created
        FROM content_chunks
        WHERE source_type = 'LEGAL_DOCUMENT'
        GROUP BY source_id
      ) cc ON cc.source_id = ld.id
      WHERE ld.content_type IN ('SFS_LAW', 'AGENCY_REGULATION')
        AND (ld.html_content IS NOT NULL OR ld.json_content IS NOT NULL OR ld.markdown_content IS NOT NULL)
        AND (cc.max_chunk_created IS NULL OR ld.updated_at > cc.max_chunk_created)
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    // Stuck docs: needing chunks for >24h (updated before cutoff but still no fresh chunks)
    prisma.$queryRaw<Array<{ document_number: string; updated_at: Date }>>`
      SELECT ld.document_number, ld.updated_at
      FROM legal_documents ld
      LEFT JOIN (
        SELECT source_id, MAX(created_at) as max_chunk_created
        FROM content_chunks
        WHERE source_type = 'LEGAL_DOCUMENT'
        GROUP BY source_id
      ) cc ON cc.source_id = ld.id
      WHERE ld.content_type IN ('SFS_LAW', 'AGENCY_REGULATION')
        AND (ld.html_content IS NOT NULL OR ld.json_content IS NOT NULL OR ld.markdown_content IS NOT NULL)
        AND (cc.max_chunk_created IS NULL OR ld.updated_at > cc.max_chunk_created)
        AND ld.updated_at < ${cutoff}
      ORDER BY ld.updated_at ASC
      LIMIT 5
    `,
  ])

  const total = Number(totals[0]?.total ?? 0)
  const withPrefix = Number(totals[0]?.with_prefix ?? 0)
  const withEmbedding = Number(totals[0]?.with_embedding ?? 0)

  return {
    totalChunks: total,
    withPrefix,
    withoutPrefix: total - withPrefix,
    withEmbedding,
    withoutEmbedding: total - withEmbedding,
    chunksCreated24h: created24h,
    docsNeedingChunks: docsNeeding,
    stuckDocs: stuckDocs.map((d) => ({
      documentNumber: d.document_number,
      updatedAt: d.updated_at,
    })),
  }
}

// ---------------------------------------------------------------------------
// HTML Builder
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${Math.round(ms / 1000)}s`
}

const STYLES = {
  table:
    'border-collapse: collapse; width: 100%; font-family: -apple-system, sans-serif; font-size: 14px;',
  th: 'padding: 8px 12px; border: 1px solid #ddd; background: #e9ecef; text-align: left; font-weight: 600;',
  td: 'padding: 8px 12px; border: 1px solid #ddd;',
  tdRight: 'padding: 8px 12px; border: 1px solid #ddd; text-align: right;',
  section: 'margin-bottom: 28px;',
  h2: 'margin: 0 0 12px 0; font-size: 18px; color: #333;',
  h3: 'margin: 0 0 8px 0; font-size: 15px; color: #555;',
  red: 'color: #dc3545; font-weight: 600;',
  green: 'color: #28a745;',
  muted: 'color: #666; font-size: 12px;',
  badge: (color: string) =>
    `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: white; background: ${color};`,
}

function statusBadge(status: string | null): string {
  if (!status) return '<span style="color: #999;">—</span>'
  const colors: Record<string, string> = {
    SUCCESS: '#28a745',
    FAILED: '#dc3545',
    RUNNING: '#ffc107',
  }
  const color = colors[status] ?? '#6c757d'
  return `<span style="${STYLES.badge(color)}">${status}</span>`
}

export function buildDigestEmailHtml(data: DigestData): string {
  const dateStr = new Date().toLocaleDateString('sv-SE')

  const sections: string[] = []

  // Section 1: Ingestion Summary
  sections.push(buildIngestionSection(data.ingestion, dateStr))

  // Section 2: Gap Detection
  sections.push(buildGapSection(data.gaps))

  // Section 3: Job Health
  sections.push(buildJobHealthSection(data.jobHealth))

  // Section 4: Notification Backlog
  sections.push(buildBacklogSection(data.backlog))

  // Section 5: Amendment Pipeline
  sections.push(buildPipelineSection(data.pipeline))

  // Section 6: Chunk Health
  sections.push(buildChunkHealthSection(data.chunkHealth))

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="font-size: 22px; margin-bottom: 4px;">Daglig driftöversikt</h1>
      <p style="${STYLES.muted}; margin-top: 0;">${dateStr} &middot; Laglig.se</p>
      <hr style="border: none; border-top: 2px solid #e9ecef; margin: 16px 0 24px;">
      ${sections.join('\n')}
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0 12px;">
      <p style="font-size: 11px; color: #999;">
        Automatisk sammanfattning från Laglig.se &middot; daily-ops-digest
      </p>
    </body>
    </html>
  `
}

function buildIngestionSection(
  ingestion: IngestionSummary | null,
  _dateStr: string
): string {
  if (!ingestion) {
    return `<div style="${STYLES.section}"><h2 style="${STYLES.h2}">1. Inmatning (senaste 24h)</h2><p style="${STYLES.red}">Data unavailable</p></div>`
  }

  const rangeStr =
    ingestion.sfsRange.min && ingestion.sfsRange.max
      ? `${ingestion.sfsRange.min} – ${ingestion.sfsRange.max}`
      : 'Inga nya'

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">1. Inmatning (senaste 24h)</h2>
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.td}">Nya ändringsförfattningar</td>
          <td style="${STYLES.tdRight}"><strong>${ingestion.amendments}</strong></td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Nya lagar (Riksdagen API)</td>
          <td style="${STYLES.tdRight}"><strong>${ingestion.newLaws}</strong></td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Ändringsnotiser skapade</td>
          <td style="${STYLES.tdRight}">${ingestion.changeEvents}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">AI-sammanfattningar</td>
          <td style="${STYLES.tdRight}">${ingestion.summariesGenerated}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">SFS-intervall</td>
          <td style="${STYLES.tdRight}">${rangeStr}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Chunks skapade (24h)</td>
          <td style="${STYLES.tdRight}">${ingestion.chunksCreated}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Dokument utan chunks</td>
          <td style="${STYLES.tdRight}${ingestion.docsNeedingChunks > 0 ? '; ' + STYLES.red : ''}">${ingestion.docsNeedingChunks}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">AI-sammanfattningar (24h)</td>
          <td style="${STYLES.tdRight}">${ingestion.summariesGenerated24h}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Ändringar utan sammanfattning</td>
          <td style="${STYLES.tdRight}${ingestion.amendmentsNeedingSummary > 0 ? '; ' + STYLES.red : ''}">${ingestion.amendmentsNeedingSummary}</td>
        </tr>
      </table>
    </div>
  `
}

function buildGapSection(gaps: GapDetectionResult | null): string {
  if (!gaps) {
    return `<div style="${STYLES.section}"><h2 style="${STYLES.h2}">2. Gap-detektion</h2><p style="${STYLES.red}">Data unavailable</p></div>`
  }

  if (gaps.error) {
    return `
      <div style="${STYLES.section}">
        <h2 style="${STYLES.h2}">2. Gap-detektion (${gaps.year})</h2>
        <p style="${STYLES.red}">Gap-detektion otillgänglig: ${escapeHtml(gaps.error)}</p>
      </div>
    `
  }

  const hasGaps = gaps.missing.length > 0
  const statusColor = hasGaps ? STYLES.red : STYLES.green

  let missingList = ''
  if (hasGaps) {
    missingList = `
      <h3 style="${STYLES.h3}; margin-top: 12px;">Saknade SFS-nummer (${gaps.missing.length}):</h3>
      <p style="${STYLES.red}">${gaps.missing.map(escapeHtml).join(', ')}</p>
    `
  }

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">2. Gap-detektion (${gaps.year})</h2>
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.td}">På svenskforfattningssamling.se</td>
          <td style="${STYLES.tdRight}">${gaps.indexCount}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">I databasen</td>
          <td style="${STYLES.tdRight}">${gaps.dbCount}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Saknade</td>
          <td style="${STYLES.tdRight}; ${statusColor}"><strong>${gaps.missing.length}</strong></td>
        </tr>
      </table>
      ${missingList}
    </div>
  `
}

function buildJobHealthSection(jobs: JobHealthEntry[]): string {
  const rows = jobs
    .map((job) => {
      const staleFlag = job.isStale
        ? `<span style="${STYLES.red}"> (stale)</span>`
        : ''
      const failedStyle =
        job.itemsFailed && job.itemsFailed > 0 ? `style="${STYLES.red}"` : ''

      return `
        <tr>
          <td style="${STYLES.td}">${escapeHtml(job.displayName)}${staleFlag}</td>
          <td style="${STYLES.td}">${statusBadge(job.status)}</td>
          <td style="${STYLES.tdRight}">${formatDate(job.lastRunAt)}</td>
          <td style="${STYLES.tdRight}">${formatDuration(job.durationMs)}</td>
          <td style="${STYLES.tdRight}">${job.itemsProcessed ?? '—'}</td>
          <td ${failedStyle ? failedStyle : `style="${STYLES.tdRight}"`}>${job.itemsFailed ?? '—'}</td>
        </tr>
      `
    })
    .join('')

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">3. Jobbhälsa</h2>
      <table style="${STYLES.table}">
        <thead>
          <tr>
            <th style="${STYLES.th}">Jobb</th>
            <th style="${STYLES.th}">Status</th>
            <th style="${STYLES.th}; text-align: right;">Senaste körning</th>
            <th style="${STYLES.th}; text-align: right;">Tid</th>
            <th style="${STYLES.th}; text-align: right;">Objekt</th>
            <th style="${STYLES.th}; text-align: right;">Fel</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

function buildBacklogSection(backlog: NotificationBacklog | null): string {
  if (!backlog) {
    return `<div style="${STYLES.section}"><h2 style="${STYLES.h2}">4. Notifieringskö</h2><p style="${STYLES.red}">Data unavailable</p></div>`
  }

  const hasBacklog = backlog.unnotifiedCount > 0
  const countStyle = hasBacklog ? STYLES.red : STYLES.green

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">4. Notifieringskö</h2>
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.td}">Ej aviserade ändringar</td>
          <td style="${STYLES.tdRight}; ${countStyle}"><strong>${backlog.unnotifiedCount}</strong></td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Äldsta</td>
          <td style="${STYLES.tdRight}">${formatDate(backlog.oldestDate)}</td>
        </tr>
      </table>
    </div>
  `
}

function buildPipelineSection(
  pipeline: AmendmentPipelineStatus | null
): string {
  if (!pipeline) {
    return `<div style="${STYLES.section}"><h2 style="${STYLES.h2}">5. Ändrings-pipeline</h2><p style="${STYLES.red}">Data unavailable</p></div>`
  }

  const statusRows = Object.entries(pipeline.byStatus)
    .map(([status, count]) => {
      const isFailed = status === 'FAILED'
      return `
        <tr>
          <td style="${STYLES.td}">${status}</td>
          <td style="${STYLES.tdRight}${isFailed ? '; ' + STYLES.red : ''}"><strong>${count}</strong></td>
        </tr>
      `
    })
    .join('')

  let failureRows = ''
  if (pipeline.topFailures.length > 0) {
    failureRows = `
      <h3 style="${STYLES.h3}; margin-top: 12px;">Senaste misslyckanden:</h3>
      <table style="${STYLES.table}">
        <thead>
          <tr>
            <th style="${STYLES.th}">SFS-nummer</th>
            <th style="${STYLES.th}">Fel</th>
          </tr>
        </thead>
        <tbody>
          ${pipeline.topFailures
            .map(
              (f) => `
            <tr>
              <td style="${STYLES.td}">${escapeHtml(f.sfsNumber)}</td>
              <td style="${STYLES.td}; font-size: 12px;">${escapeHtml(f.error.substring(0, 120))}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
  }

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">5. Ändrings-pipeline (${new Date().getFullYear()})</h2>
      <table style="${STYLES.table}">
        ${statusRows}
      </table>
      ${failureRows}
    </div>
  `
}

function buildChunkHealthSection(
  chunkHealth: ChunkHealthStatus | null
): string {
  if (!chunkHealth) {
    return `<div style="${STYLES.section}"><h2 style="${STYLES.h2}">6. Chunk-hälsa</h2><p style="${STYLES.red}">Data unavailable</p></div>`
  }

  const prefixPct =
    chunkHealth.totalChunks > 0
      ? ((chunkHealth.withPrefix / chunkHealth.totalChunks) * 100).toFixed(1)
      : '0'
  const embedPct =
    chunkHealth.totalChunks > 0
      ? ((chunkHealth.withEmbedding / chunkHealth.totalChunks) * 100).toFixed(1)
      : '0'

  const prefixStyle =
    chunkHealth.withoutPrefix > 0 ? `; ${STYLES.red}` : `; ${STYLES.green}`
  const embedStyle =
    chunkHealth.withoutEmbedding > 0 ? `; ${STYLES.red}` : `; ${STYLES.green}`
  const stuckStyle = chunkHealth.stuckDocs.length > 0 ? `; ${STYLES.red}` : ''

  let stuckList = ''
  if (chunkHealth.stuckDocs.length > 0) {
    stuckList = `
      <h3 style="${STYLES.h3}; margin-top: 12px;">Fastnade dokument (>24h utan chunks):</h3>
      <table style="${STYLES.table}">
        <thead>
          <tr>
            <th style="${STYLES.th}">Dokument</th>
            <th style="${STYLES.th}; text-align: right;">Uppdaterad</th>
          </tr>
        </thead>
        <tbody>
          ${chunkHealth.stuckDocs
            .map(
              (d) => `
            <tr>
              <td style="${STYLES.td}">${escapeHtml(d.documentNumber)}</td>
              <td style="${STYLES.tdRight}">${formatDate(d.updatedAt)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
  }

  return `
    <div style="${STYLES.section}">
      <h2 style="${STYLES.h2}">6. Chunk-hälsa (RAG-pipeline)</h2>
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.td}">Totalt chunks</td>
          <td style="${STYLES.tdRight}">${chunkHealth.totalChunks.toLocaleString('sv-SE')}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Chunks skapade (24h)</td>
          <td style="${STYLES.tdRight}">${chunkHealth.chunksCreated24h}</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Med context_prefix</td>
          <td style="${STYLES.tdRight}${prefixStyle}">${chunkHealth.withPrefix.toLocaleString('sv-SE')} (${prefixPct}%)</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Utan context_prefix</td>
          <td style="${STYLES.tdRight}${prefixStyle}"><strong>${chunkHealth.withoutPrefix.toLocaleString('sv-SE')}</strong></td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Med embedding</td>
          <td style="${STYLES.tdRight}${embedStyle}">${chunkHealth.withEmbedding.toLocaleString('sv-SE')} (${embedPct}%)</td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Utan embedding</td>
          <td style="${STYLES.tdRight}${embedStyle}"><strong>${chunkHealth.withoutEmbedding.toLocaleString('sv-SE')}</strong></td>
        </tr>
        <tr>
          <td style="${STYLES.td}">Dokument utan chunks</td>
          <td style="${STYLES.tdRight}${stuckStyle}">${chunkHealth.docsNeedingChunks}</td>
        </tr>
      </table>
      ${stuckList}
    </div>
  `
}

// ---------------------------------------------------------------------------
// Subject builder
// ---------------------------------------------------------------------------

export function buildDigestSubject(data: DigestData): string {
  const dateStr = new Date().toLocaleDateString('sv-SE')

  const hasIssues =
    (data.gaps && (data.gaps.missing.length > 0 || data.gaps.error)) ||
    (data.backlog && data.backlog.unnotifiedCount > 0) ||
    data.jobHealth.some((j) => j.status === 'FAILED' || j.isStale) ||
    (data.chunkHealth && data.chunkHealth.stuckDocs.length > 0)

  const prefix = hasIssues ? '\u26A0\uFE0F' : '\u2705'
  return `${prefix} Daglig driftöversikt — ${dateStr}`
}

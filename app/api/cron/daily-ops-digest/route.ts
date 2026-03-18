/**
 * Daily Ops Monitoring Digest Cron Job
 *
 * Gathers pipeline health data across all ingestion jobs, detects SFS gaps
 * by comparing the svenskforfattningssamling.se index against the database,
 * and sends a single HTML email at 08:00 UTC.
 *
 * Runs daily at 08:00 UTC (after all other cron jobs have completed).
 */

import { NextResponse } from 'next/server'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import { sendHtmlEmail } from '@/lib/email/email-service'
import {
  gatherIngestionSummary,
  gatherGapDetection,
  gatherJobHealth,
  gatherNotificationBacklog,
  gatherAmendmentPipeline,
  gatherChunkHealth,
  buildDigestEmailHtml,
  buildDigestSubject,
  type DigestData,
} from '@/lib/email/daily-ops-digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_EMAIL = process.env.CRON_NOTIFICATION_EMAIL || 'admin@laglig.se'

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('daily-ops-digest', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const year = now.getFullYear()

    // Check if early January — also scan previous year
    const checkPreviousYear = now.getMonth() === 0 && now.getDate() <= 14

    // Gather all 5 data sections via Promise.allSettled
    // Gap detection failure should not kill the entire digest
    const [
      ingestionResult,
      gapResult,
      previousYearGapResult,
      jobHealthResult,
      backlogResult,
      pipelineResult,
      chunkHealthResult,
    ] = await Promise.allSettled([
      gatherIngestionSummary(cutoff),
      gatherGapDetection(year),
      checkPreviousYear ? gatherGapDetection(year - 1) : Promise.resolve(null),
      gatherJobHealth(),
      gatherNotificationBacklog(),
      gatherAmendmentPipeline(year),
      gatherChunkHealth(cutoff),
    ])

    // Log any rejected promises for visibility
    const allResults = [
      { name: 'ingestion', result: ingestionResult },
      { name: 'gaps', result: gapResult },
      { name: 'previousYearGaps', result: previousYearGapResult },
      { name: 'jobHealth', result: jobHealthResult },
      { name: 'backlog', result: backlogResult },
      { name: 'pipeline', result: pipelineResult },
      { name: 'chunkHealth', result: chunkHealthResult },
    ]
    for (const { name, result } of allResults) {
      if (result.status === 'rejected') {
        console.error(
          `[DAILY-OPS-DIGEST] ${name} data gathering failed:`,
          result.reason
        )
      }
    }

    const data: DigestData = {
      ingestion:
        ingestionResult.status === 'fulfilled' ? ingestionResult.value : null,
      gaps: gapResult.status === 'fulfilled' ? gapResult.value : null,
      jobHealth:
        jobHealthResult.status === 'fulfilled' ? jobHealthResult.value : [],
      backlog:
        backlogResult.status === 'fulfilled' ? backlogResult.value : null,
      pipeline:
        pipelineResult.status === 'fulfilled' ? pipelineResult.value : null,
      chunkHealth:
        chunkHealthResult.status === 'fulfilled'
          ? chunkHealthResult.value
          : null,
    }

    // Merge previous year gaps if applicable
    if (
      checkPreviousYear &&
      previousYearGapResult.status === 'fulfilled' &&
      previousYearGapResult.value &&
      previousYearGapResult.value.missing.length > 0
    ) {
      const prevYearMissing = previousYearGapResult.value.missing.map(
        (sfs) => `(${year - 1}) ${sfs}`
      )

      if (data.gaps) {
        // Merge into current year results
        data.gaps.missing = [...prevYearMissing, ...data.gaps.missing]
      } else {
        // Current year failed — still show previous year gaps
        data.gaps = {
          year,
          indexCount: 0,
          dbCount: 0,
          missing: prevYearMissing,
          error: 'Årets gap-detektion misslyckades, visar föregående år',
        }
      }
    }

    // Build and send email
    const subject = buildDigestSubject(data)
    const html = buildDigestEmailHtml(data)

    const emailResult = await sendHtmlEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
      from: 'cron',
    })

    if (!emailResult.success) {
      console.error(
        '[DAILY-OPS-DIGEST] Failed to send email:',
        emailResult.error
      )
    }

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: 1,
        itemsFailed: emailResult.success ? 0 : 1,
      })
    }

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      subject,
      sections: {
        ingestion: ingestionResult.status === 'fulfilled',
        gaps: gapResult.status === 'fulfilled',
        jobHealth: jobHealthResult.status === 'fulfilled',
        backlog: backlogResult.status === 'fulfilled',
        pipeline: pipelineResult.status === 'fulfilled',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[DAILY-OPS-DIGEST] Job failed:', error)

    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }

    // Attempt minimal failure notification
    try {
      await sendHtmlEmail({
        to: ADMIN_EMAIL,
        subject: `\u274C Daglig driftöversikt MISSLYCKADES — ${new Date().toLocaleDateString('sv-SE')}`,
        html: `
          <h2>Daily Ops Digest Failed</h2>
          <p style="color: red;"><strong>Error:</strong> ${
            error instanceof Error ? error.message : 'Unknown error'
          }</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `,
        from: 'cron',
      })
    } catch {
      // Can't even send failure email — nothing more we can do
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

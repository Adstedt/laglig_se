/* eslint-disable no-console */
/**
 * Cron Job Email Notifications
 *
 * Sends summary emails after cron job completion via Resend.
 */

import { Resend } from 'resend'

// Lazy initialization to avoid errors when API key is not configured
let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const ADMIN_EMAIL = process.env.CRON_NOTIFICATION_EMAIL || 'admin@laglig.se'
const FROM_EMAIL = 'cron@laglig.se'

export interface SfsSyncStats {
  apiCount: number
  fetched: number
  inserted: number
  updated?: number // Optional - only used by sync-sfs-updates job
  skipped: number
  failed: number
  dateRange: { from: string; to: string }
  // Story 2.28: PDF and amendment stats
  pdfsFetched?: number
  pdfsStored?: number
  pdfsFailed?: number
  amendmentsCreated?: number
  amendmentsParsed?: number // Story 2.28 AC8: LLM-parsed amendments
}

export interface CourtSyncStats {
  total: {
    fetched: number
    inserted: number
    skipped: number
    errors: number
    crossRefsCreated: number
  }
  byCourt: Array<{
    court: string
    courtName: string
    inserted: number
    skipped: number
    errors: number
    earlyTerminated: boolean
  }>
}

export interface SummaryStats {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  remainingPending?: number
}

/**
 * Send SFS sync completion email
 */
export async function sendSfsSyncEmail(
  stats: SfsSyncStats,
  duration: string,
  success: boolean,
  error?: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email notification')
    return
  }

  const statusEmoji = success ? '✅' : '❌'
  const subject = `${statusEmoji} SFS Sync ${success ? 'Complete' : 'Failed'} - ${new Date().toLocaleDateString('sv-SE')}`

  const hasChanges = stats.inserted > 0 || (stats.updated ?? 0) > 0

  const html = `
    <h2>SFS Laws Daily Sync Report</h2>
    <p><strong>Status:</strong> ${success ? 'Completed' : 'Failed'}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>

    ${error ? `<p style="color: red;"><strong>Error:</strong> ${error}</p>` : ''}

    <h3>Statistics</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr style="background: ${stats.inserted > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>New Laws Inserted</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.inserted}</td>
      </tr>
      ${
        stats.updated !== undefined
          ? `
      <tr style="background: ${stats.updated > 0 ? '#fff3cd' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Laws Updated</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.updated}</td>
      </tr>
      `
          : ''
      }
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Fetched from API</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.fetched}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Skipped (no changes)</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.skipped}</td>
      </tr>
      <tr style="background: ${stats.failed > 0 ? '#f8d7da' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Failed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.failed}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Total in Riksdagen API</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.apiCount.toLocaleString()}</td>
      </tr>
    </table>

    ${
      stats.pdfsFetched !== undefined
        ? `
    <h3>PDF & Document Stats</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr style="background: ${stats.pdfsStored && stats.pdfsStored > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>PDFs Stored</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.pdfsStored || 0}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">PDFs Attempted</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.pdfsFetched || 0}</td>
      </tr>
      <tr style="background: ${stats.pdfsFailed && stats.pdfsFailed > 0 ? '#f8d7da' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">PDFs Failed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.pdfsFailed || 0}</td>
      </tr>
      ${
        stats.amendmentsCreated !== undefined
          ? `
      <tr style="background: ${stats.amendmentsCreated > 0 ? '#fff3cd' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Amendments Created</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.amendmentsCreated}</td>
      </tr>
      `
          : ''
      }
      ${
        stats.amendmentsParsed !== undefined
          ? `
      <tr style="background: ${stats.amendmentsParsed > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Amendments Parsed (LLM)</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.amendmentsParsed}</td>
      </tr>
      `
          : ''
      }
    </table>
    `
        : ''
    }

    <p style="margin-top: 16px; color: #666;">
      📅 Date range: ${stats.dateRange.from} to ${stats.dateRange.to}
      ${!hasChanges ? '<br>📭 No new changes detected' : ''}
    </p>

    <hr style="margin-top: 24px;">
    <p style="font-size: 12px; color: #999;">
      This is an automated notification from Laglig.se cron jobs.
    </p>
  `

  const client = getResend()
  if (!client) return

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    })
    console.log('SFS sync notification email sent')
  } catch (err) {
    console.error('Failed to send SFS sync email:', err)
  }
}

/**
 * Send Court Cases sync completion email
 */
export async function sendCourtSyncEmail(
  stats: CourtSyncStats,
  duration: string,
  success: boolean,
  error?: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email notification')
    return
  }

  const statusEmoji = success ? '✅' : '❌'
  const subject = `${statusEmoji} Court Cases Sync ${success ? 'Complete' : 'Failed'} - ${new Date().toLocaleDateString('sv-SE')}`

  const hasChanges = stats.total.inserted > 0

  const courtRows = stats.byCourt
    .map(
      (c) => `
      <tr style="background: ${c.inserted > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">${c.courtName}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${c.inserted}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${c.skipped}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${c.errors}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${c.earlyTerminated ? '⚡' : ''}</td>
      </tr>
    `
    )
    .join('')

  const html = `
    <h2>Court Cases Daily Sync Report</h2>
    <p><strong>Status:</strong> ${success ? 'Completed' : 'Failed'}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>

    ${error ? `<p style="color: red;"><strong>Error:</strong> ${error}</p>` : ''}

    <h3>Summary</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr style="background: ${stats.total.inserted > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>New Cases Inserted</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.total.inserted}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Total Fetched</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.total.fetched}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Cross-refs Created</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.total.crossRefsCreated}</td>
      </tr>
      <tr style="background: ${stats.total.errors > 0 ? '#f8d7da' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Errors</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.total.errors}</td>
      </tr>
    </table>

    <h3>By Court</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background: #e9ecef;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Court</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Inserted</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Skipped</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Errors</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Done</th>
        </tr>
      </thead>
      <tbody>
        ${courtRows}
      </tbody>
    </table>

    <p style="margin-top: 16px; color: #666;">
      ${!hasChanges ? '📭 No new court cases today' : ''}
    </p>

    <hr style="margin-top: 24px;">
    <p style="font-size: 12px; color: #999;">
      This is an automated notification from Laglig.se cron jobs.
    </p>
  `

  const client = getResend()
  if (!client) return

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    })
    console.log('Court sync notification email sent')
  } catch (err) {
    console.error('Failed to send court sync email:', err)
  }
}

/**
 * Send AI Summary generation completion email
 */
export async function sendSummaryGenEmail(
  stats: SummaryStats,
  duration: string,
  success: boolean,
  error?: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email notification')
    return
  }

  // Only send email if there was actual work done or errors
  if (stats.processed === 0 && success) {
    console.log('No summaries processed, skipping email')
    return
  }

  const statusEmoji = success ? '✅' : '❌'
  const subject = `${statusEmoji} AI Summaries ${success ? 'Generated' : 'Failed'} - ${new Date().toLocaleDateString('sv-SE')}`

  const html = `
    <h2>AI Summary Generation Report</h2>
    <p><strong>Status:</strong> ${success ? 'Completed' : 'Failed'}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>

    ${error ? `<p style="color: red;"><strong>Error:</strong> ${error}</p>` : ''}

    <h3>Statistics</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Processed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.processed}</td>
      </tr>
      <tr style="background: ${stats.succeeded > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Succeeded</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.succeeded}</td>
      </tr>
      <tr style="background: ${stats.failed > 0 ? '#f8d7da' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Failed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.failed}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Skipped</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.skipped}</td>
      </tr>
      ${
        stats.remainingPending !== undefined
          ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Remaining in Queue</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.remainingPending}</td>
      </tr>
      `
          : ''
      }
    </table>

    <hr style="margin-top: 24px;">
    <p style="font-size: 12px; color: #999;">
      This is an automated notification from Laglig.se cron jobs.
    </p>
  `

  const client = getResend()
  if (!client) return

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    })
    console.log('Summary gen notification email sent')
  } catch (err) {
    console.error('Failed to send summary gen email:', err)
  }
}

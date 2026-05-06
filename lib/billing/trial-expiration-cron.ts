/**
 * Story 5.13: Trial-expiration cron actions.
 *
 * Three pure functions invoked by /api/cron/expire-trials each daily run:
 *   1. notifyExpiredTrials   — Day 15+: send trial-ended email, lock idempotency timestamp
 *   2. pauseAbandonedTrials  — Day 45+: flip status=PAUSED, send paused email
 *   3. deleteAbandonedTrials — Day 75+: flip status=DELETED (existing
 *      cleanup-workspaces cron then hard-deletes 30 days later)
 *
 * Each function is independent + per-row try/catch so a single bad workspace
 * never blocks the rest of the run.
 *
 * Email-send failures are caught + logged but NEVER re-thrown — state-machine
 * transitions take precedence over email delivery (mirrors 14.27 + 5.12 patterns).
 */

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/email-service'
import { logActivity } from '@/lib/services/activity-logger'
import { TrialEndedEmail } from '@/emails/trial-ended'
import { WorkspacePausedEmail } from '@/emails/workspace-paused'
import { EnterpriseInquiryTrialEndedEmail } from '@/emails/enterprise-inquiry-trial-ended'
import { env } from '@/lib/env'
import { TRIAL_GRACE_PAUSE_DAYS, TRIAL_GRACE_DELETE_DAYS } from './trial-config'

export interface CronActionResult {
  processed: number
  failed: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const billingUrl = (utmCampaign: string): string =>
  `${env.NEXT_PUBLIC_APP_URL}/settings/billing?reason=trial_expired&utm_source=email&utm_medium=trial&utm_campaign=${utmCampaign}`

/**
 * Action 1 — Notify expired trials. Idempotent via trial_expired_notified_at.
 *
 * Matches: TRIAL workspaces past trial_ends_at with no Stripe subscription
 * AND not yet notified. Sets the lock timestamp BEFORE sending email so a
 * crashed email send doesn't cause re-notification on next run.
 */
export async function notifyExpiredTrials(): Promise<CronActionResult> {
  const now = new Date()
  const expired = await prisma.workspace.findMany({
    where: {
      subscription_tier: 'TRIAL',
      trial_ends_at: { lt: now },
      trial_expired_notified_at: null,
      stripe_subscription_id: null,
    },
    select: {
      id: true,
      name: true,
      owner_id: true,
      trial_picked_tier: true,
      enterprise_inquiry_at: true,
      trial_ends_at: true,
      owner: { select: { email: true } },
    },
  })

  let processed = 0
  let failed = 0

  for (const workspace of expired) {
    try {
      // Lock idempotency timestamp first so a mid-row crash doesn't re-trigger.
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { trial_expired_notified_at: now },
      })

      await logActivity(
        workspace.id,
        workspace.owner_id,
        'workspace',
        workspace.id,
        'trial_expired',
        null,
        {
          trial_ends_at: workspace.trial_ends_at,
          picked_tier: workspace.trial_picked_tier,
        }
      )

      // Customer-facing trial-ended email. Fail-safe: catch + log + continue.
      // trial_picked_tier is SubscriptionTier | null (includes TRIAL — narrow
      // to the 3 paid tiers; default SOLO covers NULL + the can't-happen TRIAL).
      const picked = workspace.trial_picked_tier
      const pickedTierForEmail: 'SOLO' | 'TEAM' | 'ENTERPRISE' =
        picked === 'TEAM' || picked === 'ENTERPRISE' ? picked : 'SOLO'
      try {
        await sendEmail({
          to: workspace.owner.email,
          subject: 'Din provperiod är slut — aktivera för att fortsätta',
          react: TrialEndedEmail({
            workspaceName: workspace.name,
            pickedTier: pickedTierForEmail,
            hasEnterpriseInquiry: workspace.enterprise_inquiry_at !== null,
            manageBillingUrl: billingUrl('trial_ended'),
          }),
          from: 'no-reply',
        })
      } catch (err) {
        console.error('[TRIAL_EXPIRED_EMAIL_FAIL]', workspace.id, err)
      }

      // Sales re-ping for Enterprise inquirers — internal nudge.
      if (workspace.enterprise_inquiry_at) {
        const daysSinceInquiry = Math.max(
          1,
          Math.floor(
            (now.getTime() - workspace.enterprise_inquiry_at.getTime()) /
              MS_PER_DAY
          )
        )
        try {
          await sendEmail({
            to: env.SALES_NOTIFICATION_EMAIL,
            subject: `Enterprise-lead: trial slut — följ upp ${workspace.name}`,
            react: EnterpriseInquiryTrialEndedEmail({
              workspaceName: workspace.name,
              ownerEmail: workspace.owner.email,
              daysSinceInquiry,
            }),
            from: 'notifications',
          })
        } catch (err) {
          console.error('[ENTERPRISE_INQUIRY_REPING_FAIL]', workspace.id, err)
        }
      }

      processed++
    } catch (err) {
      console.error('[TRIAL_EXPIRED_NOTIFY_FAIL]', workspace.id, err)
      failed++
    }
  }

  return { processed, failed }
}

/**
 * Action 2 — Pause workspaces 30 days past trial_ends_at without conversion.
 * Idempotent because the WHERE clause requires status='ACTIVE'.
 */
export async function pauseAbandonedTrials(): Promise<CronActionResult> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - TRIAL_GRACE_PAUSE_DAYS * MS_PER_DAY)

  const candidates = await prisma.workspace.findMany({
    where: {
      subscription_tier: 'TRIAL',
      status: 'ACTIVE',
      trial_ends_at: { lt: cutoff },
      stripe_subscription_id: null,
    },
    select: {
      id: true,
      name: true,
      owner_id: true,
      owner: { select: { email: true } },
    },
  })

  let processed = 0
  let failed = 0

  for (const workspace of candidates) {
    try {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'PAUSED', paused_at: now },
      })

      await logActivity(
        workspace.id,
        workspace.owner_id,
        'workspace',
        workspace.id,
        'trial_paused'
      )

      try {
        await sendEmail({
          to: workspace.owner.email,
          subject: 'Din workspace har pausats',
          react: WorkspacePausedEmail({
            workspaceName: workspace.name,
            daysUntilDeletion: TRIAL_GRACE_DELETE_DAYS - TRIAL_GRACE_PAUSE_DAYS,
            reactivateUrl: billingUrl('workspace_paused'),
          }),
          from: 'no-reply',
        })
      } catch (err) {
        console.error('[WORKSPACE_PAUSED_EMAIL_FAIL]', workspace.id, err)
      }

      processed++
    } catch (err) {
      console.error('[TRIAL_PAUSE_FAIL]', workspace.id, err)
      failed++
    }
  }

  return { processed, failed }
}

/**
 * Action 3 — Soft-delete workspaces 60 days past trial_ends_at without
 * conversion. The existing cleanup-workspaces cron (Story 5.1) hard-deletes
 * 30 days after deleted_at is set.
 */
export async function deleteAbandonedTrials(): Promise<CronActionResult> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - TRIAL_GRACE_DELETE_DAYS * MS_PER_DAY)

  const candidates = await prisma.workspace.findMany({
    where: {
      subscription_tier: 'TRIAL',
      status: 'PAUSED',
      trial_ends_at: { lt: cutoff },
      stripe_subscription_id: null,
    },
    select: { id: true, owner_id: true },
  })

  let processed = 0
  let failed = 0

  for (const workspace of candidates) {
    try {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { status: 'DELETED', deleted_at: now },
      })

      await logActivity(
        workspace.id,
        workspace.owner_id,
        'workspace',
        workspace.id,
        'trial_workspace_deleted'
      )

      processed++
    } catch (err) {
      console.error('[TRIAL_DELETE_FAIL]', workspace.id, err)
      failed++
    }
  }

  return { processed, failed }
}

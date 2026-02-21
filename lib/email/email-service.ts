/* eslint-disable no-console */
import { Resend } from 'resend'
import type { NotificationType } from '@prisma/client'
import type React from 'react'
import { shouldSendEmail } from './notification-preferences'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// From addresses
// ---------------------------------------------------------------------------

export const FROM_ADDRESSES = {
  /** Workspace activity: task assigned, due dates, comments, mentions */
  notifications: 'Laglig.se <notifieringar@laglig.se>',
  /** Auth-critical transactional: verification, password reset, invitations, payment alerts */
  'no-reply': 'Laglig.se <no-reply@laglig.se>',
  /** Law changes: amendment digests, weekly industry digest, reminder emails */
  updates: 'Laglig.se <uppdateringar@laglig.se>',
  /** Internal admin: cron job stats */
  cron: 'Laglig.se <cron@laglig.se>',
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string
  subject: string
  react: React.ReactElement
  from?: keyof typeof FROM_ADDRESSES
  /** If provided together with userId + workspaceId, preference check runs before send */
  notificationType?: NotificationType
  userId?: string
  workspaceId?: string
}

export type SendEmailResult =
  | { success: true }
  | { success: false; error: string; skipped?: boolean }

// ---------------------------------------------------------------------------
// Resend client (lazy singleton)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// ---------------------------------------------------------------------------
// Retry helper (exponential backoff)
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, delay = 1000 } = {}
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === retries) break

      // Only retry on network / 5xx errors
      const status =
        error instanceof Error && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : 0
      if (status >= 400 && status < 500) break // Client error — don't retry

      const backoff = delay * Math.pow(2, attempt) + Math.random() * 500
      await new Promise((resolve) => setTimeout(resolve, backoff))
    }
  }

  throw lastError
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

function logInfo(message: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...data,
    })
  )
}

function logError(
  message: string,
  error: unknown,
  data?: Record<string, unknown>
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) }

  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: err,
      timestamp: new Date().toISOString(),
      ...data,
    })
  )
}

// ---------------------------------------------------------------------------
// Main send function
// ---------------------------------------------------------------------------

export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const {
    to,
    subject,
    react,
    from = 'notifications',
    notificationType,
    userId,
    workspaceId,
  } = options

  const context = {
    action: 'send_email',
    to,
    subject,
    from,
    userId,
    workspaceId,
    notificationType,
  }

  // 1. Check API key
  const client = getResend()
  if (!client) {
    logInfo('RESEND_API_KEY not configured, skipping email', context)
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  // 2. Preference check (only when full context is provided)
  if (userId && workspaceId && notificationType) {
    const shouldSend = await shouldSendEmail(
      userId,
      workspaceId,
      notificationType
    )
    if (!shouldSend) {
      logInfo('Email skipped due to user preference', context)
      return {
        success: false,
        error: 'User has opted out of this notification type',
        skipped: true,
      }
    }
  }

  // 3. Send with retry
  try {
    await withRetry(
      () =>
        client.emails.send({
          from: FROM_ADDRESSES[from],
          to,
          subject,
          react,
        }),
      { retries: 3, delay: 1000 }
    )

    logInfo('Email sent successfully', context)

    // 4. Activity log for workspace-scoped sends
    if (userId && workspaceId) {
      try {
        await prisma.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'email',
            entity_id: crypto.randomUUID(),
            action: 'notification_sent',
            new_value: {
              template: notificationType ?? 'unknown',
              recipient: to,
              subject,
            },
          },
        })
      } catch (logError_) {
        // Activity log failure should not fail the email send
        logError(
          'Failed to create activity log for email send',
          logError_,
          context
        )
      }
    }

    return { success: true }
  } catch (error) {
    logError('Failed to send email after retries', error, context)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Low-level HTML send (for cron emails that don't use React Email)
// ---------------------------------------------------------------------------

export async function sendHtmlEmail(options: {
  to: string
  subject: string
  html: string
  from?: keyof typeof FROM_ADDRESSES
}): Promise<SendEmailResult> {
  const { to, subject, html, from = 'cron' } = options

  const client = getResend()
  if (!client) {
    logInfo('RESEND_API_KEY not configured, skipping email', {
      action: 'send_html_email',
      to,
    })
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    await withRetry(
      () =>
        client.emails.send({
          from: FROM_ADDRESSES[from],
          to,
          subject,
          html,
        }),
      { retries: 3, delay: 1000 }
    )

    logInfo('HTML email sent successfully', {
      action: 'send_html_email',
      to,
      subject,
    })
    return { success: true }
  } catch (error) {
    logError('Failed to send HTML email after retries', error, {
      action: 'send_html_email',
      to,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

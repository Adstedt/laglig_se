/**
 * Story 25.5 (Epic 25, B.5): Internal ops notification when a user submits
 * the in-modal product-feedback form.
 *
 * Sent to PRODUCT_FEEDBACK_NOTIFICATION_EMAIL (default dev@laglig.se) the
 * moment `submitProductFeedback` writes a `feedback_submitted` OnboardingEvent
 * row, so the team can read raw signal directly in the inbox — no admin
 * dashboard required (PO decision 2026-05-13).
 *
 * Mirrors the structure of `emails/catalog-request-received-internal.tsx`
 * (Story 24.5) — same shared layout, same EmailIconCircle/InfoCard/Cta
 * primitives, same `from: 'no-reply'` sender at the call site.
 */

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailInfoCard,
  EmailMeta,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CHAT } from './components/email-icons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

export interface ProductFeedbackInternalEmailProps {
  sentiment: 'positive' | 'negative'
  workspaceName: string
  workspaceId: string
  userName: string | null
  userEmail: string
  /** Resolved reply-to: user-entered email if non-empty, else session email. */
  replyToEmail: string
  message: string | null
  /** Surface origin discriminator — e.g. `'onboarding_modal_feedback_tab'`. */
  source: string
}

export function ProductFeedbackInternalEmail({
  sentiment = 'positive',
  workspaceName = '',
  workspaceId = '',
  userName = null,
  userEmail = '',
  replyToEmail = '',
  message = null,
  source = '',
}: ProductFeedbackInternalEmailProps) {
  const emoji = sentiment === 'positive' ? '👍' : '👎'
  const sentimentLabel = sentiment === 'positive' ? 'positive' : 'negative'

  return (
    <LagligEmailLayout
      preview={`Ny produkt-feedback ${emoji} från ${workspaceName}`}
    >
      <EmailIconCircle src={ICON_CHAT} />
      <EmailHeading>Ny produkt-feedback {emoji}</EmailHeading>
      <EmailBody>
        <strong>{userName ?? userEmail}</strong> från{' '}
        <strong>{workspaceName}</strong> lämnade produkt-feedback via
        onboarding-guidens Feedback-flik.
      </EmailBody>

      <EmailInfoCard>
        <EmailMeta align="left">
          <strong>Sentiment:</strong> {emoji} {sentimentLabel}
        </EmailMeta>
        <EmailMeta align="left">
          <strong>Användare:</strong> {userName ?? '—'} &lt;{userEmail}&gt;
        </EmailMeta>
        <EmailMeta align="left">
          <strong>Reply-to:</strong> {replyToEmail}
        </EmailMeta>
        <EmailMeta align="left">
          <strong>Workspace:</strong> {workspaceName} (id{' '}
          <code>{workspaceId}</code>)
        </EmailMeta>
        <EmailMeta align="left">
          <strong>Inskickat från:</strong> <code>{source}</code>
        </EmailMeta>
      </EmailInfoCard>

      {message && (
        <>
          <EmailBody>
            <strong>Meddelande:</strong>
          </EmailBody>
          <EmailInfoCard>
            <EmailMeta align="left">{message}</EmailMeta>
          </EmailInfoCard>
        </>
      )}

      <EmailCta href={`${APP_URL}/admin/workspaces/${workspaceId}`}>
        Öppna admin-vyn
      </EmailCta>
    </LagligEmailLayout>
  )
}

export default ProductFeedbackInternalEmail

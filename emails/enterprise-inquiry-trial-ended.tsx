/**
 * Story 5.13: Sales re-ping email — sent from /api/cron/expire-trials when
 * an Enterprise inquirer's trial expires without sales having closed.
 *
 * Internal notification only — goes to env.SALES_NOTIFICATION_EMAIL.
 * Companion to emails/enterprise-inquiry.tsx (5.12) which fires at signup.
 *
 * `from: 'notifications'` per FROM_ADDRESSES convention — internal nudge,
 * not customer-facing.
 */
import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailInfoCard,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CLOCK } from './components/email-icons'

export interface EnterpriseInquiryTrialEndedEmailProps {
  /** Workspace name (the prospect company) */
  workspaceName: string
  /** Owner's email — populates the mailto reply CTA */
  ownerEmail: string
  /** Days since enterprise_inquiry_at was set on the workspace */
  daysSinceInquiry: number
}

const labelStyle: React.CSSProperties = {
  margin: '0',
  fontSize: '12px',
  color: '#7a7470',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const valueStyle: React.CSSProperties = {
  margin: '2px 0 12px 0',
  fontSize: '14px',
  color: '#1c1a17',
  fontWeight: 500,
}

export function EnterpriseInquiryTrialEndedEmail({
  workspaceName,
  ownerEmail,
  daysSinceInquiry,
}: EnterpriseInquiryTrialEndedEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Enterprise-lead ${workspaceName} har nått slutet av provperioden — följ upp.`}
    >
      <EmailIconCircle src={ICON_CLOCK} tone="warning" />
      <EmailHeading>Enterprise-lead: trial slut — följ upp</EmailHeading>
      <EmailBody>
        Provperioden för <strong>{workspaceName}</strong> har gått ut. Det är{' '}
        <strong>{daysSinceInquiry} dagar</strong> sedan de anmälde intresse för
        Enterprise via onboarding.
      </EmailBody>
      <EmailBody>
        Kontot är nu gated och användaren ser ett betalningskrav i appen. Om du
        vill rädda affären — kontakta nu, annars kommer de antingen konvertera
        till Team själva eller pausas om 30 dagar.
      </EmailBody>

      <EmailInfoCard>
        <p style={labelStyle}>Företag</p>
        <p style={valueStyle}>{workspaceName}</p>

        <p style={labelStyle}>Kontaktperson</p>
        <p style={valueStyle}>
          <a href={`mailto:${ownerEmail}`} style={{ color: '#1c1a17' }}>
            {ownerEmail}
          </a>
        </p>

        <p style={labelStyle}>Dagar sedan intresseanmälan</p>
        <p style={valueStyle}>{daysSinceInquiry}</p>
      </EmailInfoCard>

      <EmailCta href={`mailto:${ownerEmail}`}>Skicka mejl till kund</EmailCta>

      <EmailBody>
        Svara på det här mejlet om du har följt upp och vill flagga statusen
        internt.
      </EmailBody>
    </LagligEmailLayout>
  )
}

export default EnterpriseInquiryTrialEndedEmail

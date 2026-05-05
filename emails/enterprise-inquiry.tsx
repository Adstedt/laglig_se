/**
 * Story 5.12: Enterprise inquiry sales notification.
 *
 * Sent to env.SALES_NOTIFICATION_EMAIL when a user picks Enterprise during
 * onboarding. Workspace is created with trial_picked_tier='TEAM' (Team-tier
 * trial limits) + enterprise_inquiry_at = NOW() (this signal). Sales rep
 * follows up within ~24h to qualify and convert.
 *
 * Tone: informational (neutral). Mirrors payment-failed.tsx layout pattern.
 */
import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailInfoCard,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_ENVELOPE } from './components/email-icons'

export interface EnterpriseInquiryEmailProps {
  /** Workspace name (the prospect company) */
  workspaceName: string
  /** Owner's email — populates the mailto reply CTA */
  ownerEmail: string
  /** Captured during onboarding — all optional, render only what's present */
  orgNumber?: string
  employeeCount?: number
  sniCode?: string
  industryLabel?: string
  businessDescription?: string
  municipality?: string
  websiteUrl?: string
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

export function EnterpriseInquiryEmail({
  workspaceName,
  ownerEmail,
  orgNumber,
  employeeCount,
  sniCode,
  industryLabel,
  businessDescription,
  municipality,
  websiteUrl,
}: EnterpriseInquiryEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Ny Enterprise-intresseanmälan: ${workspaceName}`}
    >
      <EmailIconCircle src={ICON_ENVELOPE} tone="neutral" />
      <EmailHeading>Ny Enterprise-intresseanmälan</EmailHeading>
      <EmailBody>
        <strong>{workspaceName}</strong> har skapat ett konto via onboarding och
        valt Enterprise. Kontot körs på Team-nivå under provperioden (14 dagar)
        tills ni har stämt av Enterprise-villkoren.
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

        {orgNumber && (
          <>
            <p style={labelStyle}>Organisationsnummer</p>
            <p style={valueStyle}>{orgNumber}</p>
          </>
        )}

        {typeof employeeCount === 'number' && (
          <>
            <p style={labelStyle}>Antal anställda</p>
            <p style={valueStyle}>{employeeCount}</p>
          </>
        )}

        {(sniCode || industryLabel) && (
          <>
            <p style={labelStyle}>Bransch</p>
            <p style={valueStyle}>
              {industryLabel ?? sniCode}
              {industryLabel && sniCode ? ` (${sniCode})` : ''}
            </p>
          </>
        )}

        {municipality && (
          <>
            <p style={labelStyle}>Kommun</p>
            <p style={valueStyle}>{municipality}</p>
          </>
        )}

        {websiteUrl && (
          <>
            <p style={labelStyle}>Webbplats</p>
            <p style={valueStyle}>
              <a href={websiteUrl} style={{ color: '#1c1a17' }}>
                {websiteUrl}
              </a>
            </p>
          </>
        )}

        {businessDescription && (
          <>
            <p style={labelStyle}>Verksamhetsbeskrivning</p>
            <p style={{ ...valueStyle, fontWeight: 400 }}>
              {businessDescription}
            </p>
          </>
        )}
      </EmailInfoCard>

      <EmailCta href={`mailto:${ownerEmail}`}>
        Svara på kontaktpersonen
      </EmailCta>

      <EmailBody>
        <em>
          Svara på det här e-postmeddelandet om du vill diskutera internt innan
          du tar kontakt.
        </em>
      </EmailBody>
    </LagligEmailLayout>
  )
}

export default EnterpriseInquiryEmail

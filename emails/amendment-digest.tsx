import { Button, Link, Text } from '@react-email/components'
import * as React from 'react'
import {
  EmailBadge,
  EmailBody,
  EmailDivider,
  EmailHeading,
  EmailIconCircle,
  emailColors,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_LIST } from './components/email-icons'

export interface DigestChange {
  lawTitle: string
  changeType: string
  changeRef: string | null
  effectiveDate: string | null
  aiSummary: string | null
  sectionChanges: Array<{ label: string; type: string }>
  lawUrl: string
  pdfUrl: string | null
  assessUrl: string
}

export interface AmendmentDigestEmailProps {
  userName: string | null
  workspaceName: string
  changes: DigestChange[]
  unsubscribeUrl: string
}

export function AmendmentDigestEmail({
  userName = 'du',
  workspaceName = 'din arbetsyta',
  changes = [],
  unsubscribeUrl = '',
}: AmendmentDigestEmailProps) {
  const changeWord = changes.length === 1 ? 'ändring' : 'ändringar'
  return (
    <LagligEmailLayout
      preview={`${changes.length} lagändring${changes.length !== 1 ? 'ar' : ''} som påverkar lagar du bevakar`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailIconCircle src={ICON_LIST} />
      <EmailHeading>Lagändringar upptäckta</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! Det finns{' '}
        <strong>
          {changes.length} {changeWord}
        </strong>{' '}
        som påverkar lagar i bevakningslistan för{' '}
        <strong>{workspaceName}</strong>.
      </EmailBody>

      {changes.map((change, i) => (
        <React.Fragment key={i}>
          <EmailDivider />
          <div style={itemWrap}>
            <Text style={itemTitle}>{change.lawTitle}</Text>

            <div style={itemMetaRow}>
              <EmailBadge tone="neutral">{change.changeType}</EmailBadge>
              {change.changeRef && (
                <span style={itemMetaText}>genom {change.changeRef}</span>
              )}
            </div>

            {change.effectiveDate && (
              <Text style={itemDate}>
                Ikraftträdande: {change.effectiveDate}
              </Text>
            )}

            <Text style={itemSummary}>
              {change.aiSummary ?? 'En ändring har upptäckts i denna lag.'}
            </Text>

            {change.sectionChanges.length > 0 && (
              <div style={sectionBlock}>
                <Text style={sectionLabel}>Berörda paragrafer</Text>
                {change.sectionChanges.map((sc, j) => (
                  <Text key={j} style={sectionItem}>
                    {sc.label}
                  </Text>
                ))}
              </div>
            )}

            <Button href={change.assessUrl} style={itemCta}>
              Granska ändringen
            </Button>

            <div style={linksRow}>
              <Link href={change.lawUrl} style={linkStyle}>
                Visa lag
              </Link>
              {change.pdfUrl && (
                <>
                  <span style={linkSeparator}>&middot;</span>
                  <Link href={change.pdfUrl} style={linkStyle}>
                    PDF
                  </Link>
                </>
              )}
            </div>
          </div>
        </React.Fragment>
      ))}
    </LagligEmailLayout>
  )
}

const itemWrap: React.CSSProperties = {
  padding: '20px 0 0 0',
}

const itemTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: emailColors.ink,
  margin: '0 0 8px 0',
}

const itemMetaRow: React.CSSProperties = {
  margin: '0 0 6px 0',
}

const itemMetaText: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkMuted,
  marginLeft: '8px',
}

const itemDate: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkMuted,
  margin: '0 0 8px 0',
}

const itemSummary: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.6,
  color: emailColors.inkSoft,
  margin: '8px 0 0 0',
}

const sectionBlock: React.CSSProperties = {
  margin: '14px 0 0 0',
  padding: '12px 14px',
  backgroundColor: '#faf8f3',
  border: `1px solid ${emailColors.divider}`,
  borderRadius: '8px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: emailColors.inkMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  margin: '0 0 6px 0',
}

const sectionItem: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkSoft,
  margin: '0',
}

const itemCta: React.CSSProperties = {
  backgroundColor: emailColors.ctaBg,
  color: emailColors.ctaText,
  fontSize: '13px',
  fontWeight: 600,
  padding: '10px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  letterSpacing: '0.2px',
  display: 'inline-block',
  marginTop: '16px',
}

const linksRow: React.CSSProperties = {
  margin: '14px 0 0 0',
  fontSize: '13px',
}

const linkStyle: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkSoft,
  textDecoration: 'underline',
}

const linkSeparator: React.CSSProperties = {
  color: emailColors.inkFaint,
  margin: '0 8px',
}

export default AmendmentDigestEmail

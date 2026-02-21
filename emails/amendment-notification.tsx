import { Link, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface AmendmentNotificationEmailProps {
  lawTitle: string
  lawSfsNumber: string
  amendmentSfsNumber: string
  body: string
  lawUrl: string
  unsubscribeUrl?: string | undefined
}

export function AmendmentNotificationEmail({
  lawTitle,
  lawSfsNumber,
  amendmentSfsNumber,
  body,
  lawUrl,
  unsubscribeUrl,
}: AmendmentNotificationEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${lawTitle} har ändrats genom ${amendmentSfsNumber}`}
      {...(unsubscribeUrl ? { unsubscribeUrl } : {})}
    >
      <Text style={heading}>Lagändring upptäckt</Text>

      <div style={card}>
        <Text style={cardTitle}>{lawTitle}</Text>
        <Text style={cardMeta}>{lawSfsNumber}</Text>
        <Text style={cardBody}>{body}</Text>
      </div>

      <Text style={paragraph}>
        En ändring har publicerats som påverkar en lag i din bevakningslista.
        Klicka nedan för att se den uppdaterade lagtexten.
      </Text>

      <Link href={lawUrl} style={ctaButton}>
        Visa lagändring
      </Link>
    </LagligEmailLayout>
  )
}

// Styles
const heading: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: '0 0 16px',
}

const card: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 16px',
  borderLeft: '4px solid #2563eb',
}

const cardTitle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: '0 0 4px',
}

const cardMeta: React.CSSProperties = {
  fontSize: '13px',
  color: '#8898aa',
  margin: '0 0 8px',
}

const cardBody: React.CSSProperties = {
  fontSize: '14px',
  color: '#525f7f',
  margin: 0,
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '0 0 20px',
}

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 600,
}

export default AmendmentNotificationEmail

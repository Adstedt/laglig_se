import { Text } from '@react-email/components'
import * as React from 'react'
import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailInfoCard,
  emailColors,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_DOCUMENT } from './components/email-icons'

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
      <EmailIconCircle src={ICON_DOCUMENT} />
      <EmailHeading>Lagändring upptäckt</EmailHeading>
      <EmailBody>
        En ändring har publicerats som påverkar en lag i din bevakningslista.
      </EmailBody>

      <EmailInfoCard>
        <Text style={cardTitle}>{lawTitle}</Text>
        <Text style={cardMeta}>{lawSfsNumber}</Text>
        <Text style={cardBody}>{body}</Text>
      </EmailInfoCard>

      <EmailCta href={lawUrl}>Visa lagändring</EmailCta>
    </LagligEmailLayout>
  )
}

const cardTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: emailColors.ink,
  margin: '0 0 2px 0',
}

const cardMeta: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkMuted,
  margin: '0 0 10px 0',
}

const cardBody: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.6,
  color: emailColors.inkSoft,
  margin: 0,
}

export default AmendmentNotificationEmail

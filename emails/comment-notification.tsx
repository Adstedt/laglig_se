import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface CommentNotificationEmailProps {
  userName: string | null
  actorName: string
  taskTitle: string
  taskUrl: string
  isMention: boolean
  unsubscribeUrl: string
}

export function CommentNotificationEmail({
  userName = 'du',
  actorName = 'En kollega',
  taskTitle = 'Uppgift',
  taskUrl = '',
  isMention = false,
  unsubscribeUrl = '',
}: CommentNotificationEmailProps) {
  const headingText = isMention
    ? 'Du nämndes i en kommentar'
    : 'Ny kommentar på din uppgift'

  const bodyText = isMention
    ? `${actorName} nämnde dig i en kommentar på uppgiften`
    : `${actorName} kommenterade på uppgiften`

  return (
    <LagligEmailLayout
      preview={`${bodyText} "${taskTitle}"`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>{headingText}</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! <strong>{bodyText}</strong>{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong>.
      </Text>

      <Section style={ctaRow}>
        <Button href={taskUrl} style={ctaButton}>
          Visa uppgift
        </Button>
      </Section>
    </LagligEmailLayout>
  )
}

const heading: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#1a1a2e',
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '0 0 20px',
}

const ctaRow: React.CSSProperties = {
  margin: '16px 0 0',
}

const ctaButton: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
}

export default CommentNotificationEmail

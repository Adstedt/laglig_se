import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface StatusChangedNotificationEmailProps {
  userName: string | null
  actorName: string
  taskTitle: string
  newStatus: string
  taskUrl: string
  unsubscribeUrl: string
}

export function StatusChangedNotificationEmail({
  userName = 'du',
  actorName = 'En kollega',
  taskTitle = 'Uppgift',
  newStatus = '',
  taskUrl = '',
  unsubscribeUrl = '',
}: StatusChangedNotificationEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${actorName} ändrade status på "${taskTitle}" till ${newStatus}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Uppgiftens status har ändrats</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! <strong>{actorName}</strong> ändrade status på
        uppgiften <strong>&ldquo;{taskTitle}&rdquo;</strong> till{' '}
        <strong>{newStatus}</strong>.
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

export default StatusChangedNotificationEmail

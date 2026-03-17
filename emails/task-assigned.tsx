import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface TaskAssignedEmailProps {
  assigneeName: string | null
  actorName: string
  taskTitle: string
  taskUrl: string
  unsubscribeUrl: string
}

export function TaskAssignedEmail({
  assigneeName = 'du',
  actorName = 'En kollega',
  taskTitle = 'Uppgift',
  taskUrl = '',
  unsubscribeUrl = '',
}: TaskAssignedEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${actorName} tilldelade dig uppgiften "${taskTitle}"`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Du har blivit tilldelad en uppgift</Text>

      <Text style={paragraph}>
        Hej {assigneeName ?? 'du'}! <strong>{actorName}</strong> har tilldelat
        dig uppgiften <strong>&ldquo;{taskTitle}&rdquo;</strong>.
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

export default TaskAssignedEmail

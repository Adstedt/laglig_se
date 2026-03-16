import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface TaskDueReminderEmailProps {
  userName: string | null
  taskTitle: string
  daysLeft: number
  dueDate: string
  taskUrl: string
  unsubscribeUrl: string
}

export function TaskDueReminderEmail({
  userName = 'du',
  taskTitle = 'Uppgift',
  daysLeft = 3,
  dueDate = '',
  taskUrl = '',
  unsubscribeUrl = '',
}: TaskDueReminderEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Uppgiften "${taskTitle}" förfaller om ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Uppgift förfaller snart</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! Uppgiften{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong> förfaller om{' '}
        <strong>
          {daysLeft} {daysLeft === 1 ? 'dag' : 'dagar'}
        </strong>
        {dueDate && ` (${dueDate})`}.
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

export default TaskDueReminderEmail

import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface TaskOverdueEmailProps {
  userName: string | null
  taskTitle: string
  overdueDays: number
  dueDate: string
  taskUrl: string
  unsubscribeUrl: string
}

export function TaskOverdueEmail({
  userName = 'du',
  taskTitle = 'Uppgift',
  overdueDays = 1,
  dueDate = '',
  taskUrl = '',
  unsubscribeUrl = '',
}: TaskOverdueEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Uppgiften "${taskTitle}" är förfallen sedan ${overdueDays} dagar`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Uppgift är förfallen</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! Uppgiften{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong> är förfallen sedan{' '}
        <strong>
          {overdueDays} {overdueDays === 1 ? 'dag' : 'dagar'}
        </strong>
        {dueDate && ` (förföll ${dueDate})`}.
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
  backgroundColor: '#dc2626',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
}

export default TaskOverdueEmail

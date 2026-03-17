import { Button, Hr, Section, Text } from '@react-email/components'
import * as React from 'react'
import { LagligEmailLayout } from './components/laglig-email-layout'

export interface DigestTask {
  title: string
  dueDate: string | null
  priority: string
  taskUrl: string
}

export interface WeeklyTaskDigestEmailProps {
  userName: string | null
  tasks: DigestTask[]
  weekLabel: string
  unsubscribeUrl: string
}

export function WeeklyTaskDigestEmail({
  userName = 'du',
  tasks = [],
  weekLabel = 'denna vecka',
  unsubscribeUrl = '',
}: WeeklyTaskDigestEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Du har ${tasks.length} uppgift${tasks.length !== 1 ? 'er' : ''} att slutföra ${weekLabel}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={heading}>Dina uppgifter {weekLabel}</Text>

      <Text style={paragraph}>
        Hej {userName ?? 'du'}! Du har{' '}
        <strong>
          {tasks.length} uppgift{tasks.length !== 1 ? 'er' : ''}
        </strong>{' '}
        att slutföra {weekLabel}.
      </Text>

      {tasks.map((task, i) => (
        <React.Fragment key={i}>
          <Section style={card}>
            <Text style={cardTitle}>{task.title}</Text>
            <Text style={cardMeta}>
              {task.priority && (
                <span style={priorityBadge}>{task.priority}</span>
              )}
              {task.dueDate && ` Förfaller: ${task.dueDate}`}
            </Text>
            <Section style={ctaRow}>
              <Button href={task.taskUrl} style={ctaButton}>
                Visa uppgift
              </Button>
            </Section>
          </Section>
          {i < tasks.length - 1 && <Hr style={cardDivider} />}
        </React.Fragment>
      ))}
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

const card: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 4px',
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
  color: '#525f7f',
  margin: '0 0 4px',
}

const priorityBadge: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 600,
}

const ctaRow: React.CSSProperties = {
  margin: '12px 0 0',
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

const cardDivider: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '12px 0',
}

export default WeeklyTaskDigestEmail

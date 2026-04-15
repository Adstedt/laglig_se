import { Button, Text } from '@react-email/components'
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
import { ICON_CALENDAR } from './components/email-icons'

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
  const taskWord = tasks.length === 1 ? 'uppgift' : 'uppgifter'
  return (
    <LagligEmailLayout
      preview={`Du har ${tasks.length} uppgift${tasks.length !== 1 ? 'er' : ''} att slutföra ${weekLabel}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailIconCircle src={ICON_CALENDAR} />
      <EmailHeading>Dina uppgifter {weekLabel}</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! Du har{' '}
        <strong>
          {tasks.length} {taskWord}
        </strong>{' '}
        att slutföra {weekLabel}.
      </EmailBody>

      {tasks.map((task, i) => (
        <React.Fragment key={i}>
          <EmailDivider />
          <div style={itemWrap}>
            <Text style={itemTitle}>{task.title}</Text>
            <div style={itemMetaRow}>
              {task.priority && (
                <EmailBadge tone="neutral">{task.priority}</EmailBadge>
              )}
              {task.dueDate && (
                <span style={itemDueText}>Förfaller: {task.dueDate}</span>
              )}
            </div>
            {task.taskUrl && (
              <Button href={task.taskUrl} style={itemCta}>
                Visa uppgift
              </Button>
            )}
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
  margin: '0 0 14px 0',
}

const itemDueText: React.CSSProperties = {
  fontSize: '13px',
  color: emailColors.inkMuted,
  marginLeft: '8px',
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
}

export default WeeklyTaskDigestEmail

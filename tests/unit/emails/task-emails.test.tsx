import { describe, it, expect } from 'vitest'
import ReactDOMServer from 'react-dom/server'
import React from 'react'
import { TaskAssignedEmail } from '@/emails/task-assigned'
import { TaskDueReminderEmail } from '@/emails/task-due-reminder'
import { TaskOverdueEmail } from '@/emails/task-overdue'
import { CommentNotificationEmail } from '@/emails/comment-notification'
import { StatusChangedNotificationEmail } from '@/emails/status-changed-notification'
import { WeeklyTaskDigestEmail } from '@/emails/weekly-task-digest'

function renderEmail(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element)
}

describe('TaskAssignedEmail', () => {
  it('renders with all props', () => {
    const html = renderEmail(
      <TaskAssignedEmail
        assigneeName="Anna"
        actorName="Erik"
        taskTitle="Granska lag"
        taskUrl="https://laglig.se/tasks?task=123"
        unsubscribeUrl="https://laglig.se/unsubscribe"
      />
    )

    expect(html).toContain('Du har blivit tilldelad en uppgift')
    expect(html).toContain('Erik')
    expect(html).toContain('Granska lag')
    expect(html).toContain('Anna')
    expect(html).toContain('tasks?task=123')
  })

  it('renders with null assigneeName', () => {
    const html = renderEmail(
      <TaskAssignedEmail
        assigneeName={null}
        actorName="Erik"
        taskTitle="Uppgift"
        taskUrl=""
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('du')
  })
})

describe('TaskDueReminderEmail', () => {
  it('renders with all props', () => {
    const html = renderEmail(
      <TaskDueReminderEmail
        userName="Anna"
        taskTitle="Granska avtal"
        daysLeft={2}
        dueDate="2026-03-20"
        taskUrl="https://laglig.se/tasks?task=123"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('förfaller snart')
    expect(html).toContain('Granska avtal')
    expect(html).toContain('2 dagar')
    expect(html).toContain('2026-03-20')
  })

  it('uses singular "dag" for 1 day', () => {
    const html = renderEmail(
      <TaskDueReminderEmail
        userName="Anna"
        taskTitle="Uppgift"
        daysLeft={1}
        dueDate=""
        taskUrl=""
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('1 dag')
    expect(html).not.toContain('1 dagar')
  })
})

describe('TaskOverdueEmail', () => {
  it('renders with all props', () => {
    const html = renderEmail(
      <TaskOverdueEmail
        userName="Anna"
        taskTitle="Forfallen uppgift"
        overdueDays={5}
        dueDate="2026-03-10"
        taskUrl="https://laglig.se/tasks?task=456"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('förfallen')
    expect(html).toContain('5 dagar')
    expect(html).toContain('Forfallen uppgift')
    expect(html).toContain('tasks?task=456')
  })
})

describe('CommentNotificationEmail', () => {
  it('renders comment variant', () => {
    const html = renderEmail(
      <CommentNotificationEmail
        userName="Anna"
        actorName="Erik"
        taskTitle="Min uppgift"
        taskUrl=""
        isMention={false}
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('Ny kommentar')
    expect(html).toContain('Erik')
    expect(html).toContain('kommenterade')
  })

  it('renders mention variant', () => {
    const html = renderEmail(
      <CommentNotificationEmail
        userName="Anna"
        actorName="Erik"
        taskTitle="Min uppgift"
        taskUrl=""
        isMention={true}
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('nämndes')
    expect(html).toContain('Erik')
  })
})

describe('StatusChangedNotificationEmail', () => {
  it('renders with all props', () => {
    const html = renderEmail(
      <StatusChangedNotificationEmail
        userName="Anna"
        actorName="Erik"
        taskTitle="Uppgift"
        newStatus="Klar"
        taskUrl="https://laglig.se/tasks?task=789"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('status har ändrats')
    expect(html).toContain('Erik')
    expect(html).toContain('Klar')
    expect(html).toContain('tasks?task=789')
  })
})

describe('WeeklyTaskDigestEmail', () => {
  it('renders with multiple tasks', () => {
    const html = renderEmail(
      <WeeklyTaskDigestEmail
        userName="Anna"
        tasks={[
          {
            title: 'Uppgift 1',
            dueDate: '2026-03-20',
            priority: 'Hög',
            taskUrl: 'https://laglig.se/tasks?task=1',
          },
          {
            title: 'Uppgift 2',
            dueDate: '2026-03-22',
            priority: 'Medium',
            taskUrl: 'https://laglig.se/tasks?task=2',
          },
        ]}
        weekLabel="vecka 12"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('2 uppgifter')
    expect(html).toContain('Uppgift 1')
    expect(html).toContain('Uppgift 2')
    expect(html).toContain('vecka 12')
    expect(html).toContain('Hög')
  })

  it('renders singular for 1 task', () => {
    const html = renderEmail(
      <WeeklyTaskDigestEmail
        userName="Anna"
        tasks={[
          {
            title: 'Enda uppgift',
            dueDate: null,
            priority: 'Låg',
            taskUrl: '',
          },
        ]}
        weekLabel="denna vecka"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('1 uppgift')
    expect(html).not.toContain('1 uppgifter')
  })

  it('renders empty state', () => {
    const html = renderEmail(
      <WeeklyTaskDigestEmail
        userName="Anna"
        tasks={[]}
        weekLabel="denna vecka"
        unsubscribeUrl=""
      />
    )

    expect(html).toContain('0 uppgifter')
  })
})

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CLOCK } from './components/email-icons'

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
      <EmailIconCircle src={ICON_CLOCK} />
      <EmailHeading>Uppgift förfaller snart</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! Uppgiften{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong> förfaller om{' '}
        <strong>
          {daysLeft} {daysLeft === 1 ? 'dag' : 'dagar'}
        </strong>
        {dueDate && ` (${dueDate})`}.
      </EmailBody>
      <EmailCta href={taskUrl}>Visa uppgift</EmailCta>
    </LagligEmailLayout>
  )
}

export default TaskDueReminderEmail

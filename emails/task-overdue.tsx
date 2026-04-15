import {
  EmailBadge,
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_WARNING } from './components/email-icons'

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
      <EmailIconCircle src={ICON_WARNING} tone="warning" />
      <div style={{ textAlign: 'center', margin: '0 0 12px 0' }}>
        <EmailBadge tone="warning">Förfallen</EmailBadge>
      </div>
      <EmailHeading>Uppgift är förfallen</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! Uppgiften{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong> är förfallen sedan{' '}
        <strong>
          {overdueDays} {overdueDays === 1 ? 'dag' : 'dagar'}
        </strong>
        {dueDate && ` (förföll ${dueDate})`}.
      </EmailBody>
      <EmailCta href={taskUrl}>Visa uppgift</EmailCta>
    </LagligEmailLayout>
  )
}

export default TaskOverdueEmail

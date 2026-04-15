import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CHECK } from './components/email-icons'

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
      <EmailIconCircle src={ICON_CHECK} />
      <EmailHeading>Du har blivit tilldelad en uppgift</EmailHeading>
      <EmailBody>
        Hej {assigneeName ?? 'du'}! <strong>{actorName}</strong> har tilldelat
        dig uppgiften <strong>&ldquo;{taskTitle}&rdquo;</strong>.
      </EmailBody>
      <EmailCta href={taskUrl}>Visa uppgift</EmailCta>
    </LagligEmailLayout>
  )
}

export default TaskAssignedEmail

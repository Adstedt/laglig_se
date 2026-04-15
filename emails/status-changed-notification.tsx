import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_ARROW_PATH } from './components/email-icons'

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
      <EmailIconCircle src={ICON_ARROW_PATH} />
      <EmailHeading>Uppgiftens status har ändrats</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! <strong>{actorName}</strong> ändrade status på
        uppgiften <strong>&ldquo;{taskTitle}&rdquo;</strong> till{' '}
        <strong>{newStatus}</strong>.
      </EmailBody>
      <EmailCta href={taskUrl}>Visa uppgift</EmailCta>
    </LagligEmailLayout>
  )
}

export default StatusChangedNotificationEmail

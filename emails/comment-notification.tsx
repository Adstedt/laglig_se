import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CHAT } from './components/email-icons'

export interface CommentNotificationEmailProps {
  userName: string | null
  actorName: string
  taskTitle: string
  taskUrl: string
  isMention: boolean
  unsubscribeUrl: string
}

export function CommentNotificationEmail({
  userName = 'du',
  actorName = 'En kollega',
  taskTitle = 'Uppgift',
  taskUrl = '',
  isMention = false,
  unsubscribeUrl = '',
}: CommentNotificationEmailProps) {
  const headingText = isMention
    ? 'Du nämndes i en kommentar'
    : 'Ny kommentar på din uppgift'

  const bodyText = isMention
    ? `${actorName} nämnde dig i en kommentar på uppgiften`
    : `${actorName} kommenterade på uppgiften`

  return (
    <LagligEmailLayout
      preview={`${bodyText} "${taskTitle}"`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailIconCircle src={ICON_CHAT} />
      <EmailHeading>{headingText}</EmailHeading>
      <EmailBody>
        Hej {userName ?? 'du'}! <strong>{bodyText}</strong>{' '}
        <strong>&ldquo;{taskTitle}&rdquo;</strong>.
      </EmailBody>
      <EmailCta href={taskUrl}>Visa uppgift</EmailCta>
    </LagligEmailLayout>
  )
}

export default CommentNotificationEmail

import {
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  EmailSecurityNote,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_ENVELOPE } from './components/email-icons'

export interface WorkspaceInvitationEmailProps {
  workspaceName: string
  inviterName: string
  roleLabel: string
  acceptUrl: string
  unsubscribeUrl: string
}

export function WorkspaceInvitationEmail({
  workspaceName = 'Arbetsplats',
  inviterName = 'En kollega',
  roleLabel = 'Medlem',
  acceptUrl = '',
  unsubscribeUrl = '',
}: WorkspaceInvitationEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${inviterName} har bjudit in dig till ${workspaceName}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <EmailIconCircle src={ICON_ENVELOPE} />
      <EmailHeading>Du har blivit inbjuden till {workspaceName}</EmailHeading>
      <EmailBody>
        <strong>{inviterName}</strong> har bjudit in dig som{' '}
        <strong>{roleLabel}</strong> till arbetsplatsen{' '}
        <strong>{workspaceName}</strong> på Laglig.se.
      </EmailBody>
      <EmailCta href={acceptUrl}>Acceptera inbjudan</EmailCta>
      <EmailSecurityNote>
        Inbjudan gäller i 7 dagar. Efter det måste en administratör skicka en ny
        inbjudan.
      </EmailSecurityNote>
    </LagligEmailLayout>
  )
}

export default WorkspaceInvitationEmail

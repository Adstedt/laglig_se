/**
 * Story 5.13: Workspace-paused email — sent from /api/cron/expire-trials
 * 30 days after trial expiry when status flips from ACTIVE → PAUSED.
 *
 * Final escalation before deletion at Day 75. Tone is "warning" amber but
 * copy emphasizes data preservation + reactivation path.
 *
 * `from: 'no-reply'` per FROM_ADDRESSES convention — billing-critical
 * state change that affects access.
 */
import {
  EmailBadge,
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_WARNING } from './components/email-icons'

export interface WorkspacePausedEmailProps {
  workspaceName: string
  /** Days from now until status flips to DELETED (typically 30). Display only. */
  daysUntilDeletion: number
  /** Direct link to /settings/billing?reason=trial_expired */
  reactivateUrl: string
}

export function WorkspacePausedEmail({
  workspaceName,
  daysUntilDeletion,
  reactivateUrl,
}: WorkspacePausedEmailProps) {
  return (
    <LagligEmailLayout
      preview={`${workspaceName} har pausats — sista chans att aktivera innan data raderas om ${daysUntilDeletion} dagar.`}
    >
      <EmailIconCircle src={ICON_WARNING} tone="warning" />
      <div style={{ textAlign: 'center', margin: '0 0 12px 0' }}>
        <EmailBadge tone="warning">Workspace pausad</EmailBadge>
      </div>
      <EmailHeading>Din workspace har pausats</EmailHeading>
      <EmailBody>
        Hej <strong>{workspaceName}</strong>,
      </EmailBody>
      <EmailBody>
        Din workspace har pausats eftersom provperioden gick ut för 30 dagar
        sedan utan aktivering. Din data finns kvar, men åtkomsten är blockerad
        tills du aktiverar en prenumeration.
      </EmailBody>
      <EmailBody>
        <strong>Sista chans:</strong> Om du inte aktiverar inom{' '}
        <strong>{daysUntilDeletion} dagar</strong> kommer din workspace att
        raderas och all data tas bort permanent.
      </EmailBody>
      <EmailCta href={reactivateUrl}>Återaktivera workspace</EmailCta>
      <EmailBody>
        Klickar du på knappen ovan tas du till betalningssidan där du kan
        slutföra registreringen via Stripe. Åtkomsten återupprättas direkt efter
        att betalningen genomförts.
      </EmailBody>
    </LagligEmailLayout>
  )
}

export default WorkspacePausedEmail

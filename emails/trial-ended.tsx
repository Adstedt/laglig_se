/**
 * Story 5.13: Trial-ended email — sent from /api/cron/expire-trials at the
 * moment the trial gate activates (Day 15+ midnight UTC cron run).
 *
 * Tone is "warning" (amber): not punitive — the user retains all data and
 * can convert at any time. CTA goes to /settings/billing?reason=trial_expired
 * where the conversion panel pre-selects their picked tier.
 *
 * `from: 'no-reply'` per FROM_ADDRESSES convention (lib/email/email-service.ts:12)
 * — billing-critical loss of access falls under auth-critical transactional.
 */
import {
  EmailBadge,
  EmailBody,
  EmailCta,
  EmailHeading,
  EmailIconCircle,
  LagligEmailLayout,
} from './components/laglig-email-layout'
import { ICON_CLOCK } from './components/email-icons'

export interface TrialEndedEmailProps {
  /** Workspace name (the customer in commercial terms) */
  workspaceName: string
  /** Tier the user picked at signup (so copy can pre-frame their conversion) */
  pickedTier: 'SOLO' | 'TEAM' | 'ENTERPRISE'
  /** Whether this workspace flagged Enterprise interest at signup —
   * shifts copy to acknowledge the inquiry alongside the Team-checkout option. */
  hasEnterpriseInquiry: boolean
  /** Direct link to /settings/billing?reason=trial_expired with UTM */
  manageBillingUrl: string
}

const TIER_LABELS: Record<TrialEndedEmailProps['pickedTier'], string> = {
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

export function TrialEndedEmail({
  workspaceName,
  pickedTier,
  hasEnterpriseInquiry,
  manageBillingUrl,
}: TrialEndedEmailProps) {
  // Enterprise inquirers were placed on Team-tier limits during the trial
  // (per Story 5.12 — bounds COGS during the wait-for-sales window). The
  // email acknowledges the inquiry and offers self-serve Team checkout
  // alongside.
  const tierForCopy = hasEnterpriseInquiry ? 'Team' : TIER_LABELS[pickedTier]

  return (
    <LagligEmailLayout
      preview={`Din provperiod för ${workspaceName} är slut — aktivera ${tierForCopy} för att fortsätta.`}
    >
      <EmailIconCircle src={ICON_CLOCK} tone="warning" />
      <div style={{ textAlign: 'center', margin: '0 0 12px 0' }}>
        <EmailBadge tone="warning">Provperiod slut</EmailBadge>
      </div>
      <EmailHeading>Din provperiod är slut</EmailHeading>
      <EmailBody>
        Hej <strong>{workspaceName}</strong>,
      </EmailBody>
      <EmailBody>
        Din 15-dagars provperiod för Laglig.se har gått ut. Din data är kvar —
        välj en plan för att låsa upp åtkomsten igen.
      </EmailBody>
      {hasEnterpriseInquiry ? (
        <EmailBody>
          Vi har inte hunnit prata med dig än om Enterprise — vill du komma
          igång med <strong>Team</strong> så länge? Du kan när som helst byta
          plan när vi pratats vid.
        </EmailBody>
      ) : (
        <EmailBody>
          Du valde <strong>{tierForCopy}</strong> vid registreringen — den
          planen är redan förvald när du klickar nedan.
        </EmailBody>
      )}
      <EmailCta href={manageBillingUrl}>Aktivera prenumeration</EmailCta>
      <EmailBody>
        Din workspace pausas efter 30 dagar och raderas efter 60 dagar utan
        aktivering. Aktivera nu för att behålla all data.
      </EmailBody>
    </LagligEmailLayout>
  )
}

export default TrialEndedEmail

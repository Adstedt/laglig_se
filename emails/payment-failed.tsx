/**
 * Story 5.4: Payment failed email — sent from invoice.payment_failed webhook.
 *
 * Mirrors task-overdue.tsx layout pattern. Tone is "warning" (amber): not yet
 * a hard failure — the workspace still has 3 days to update payment before
 * access is blocked at the workspace-context boundary.
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

export interface PaymentFailedEmailProps {
  /** Workspace name (the customer in commercial terms) */
  companyName: string
  /** Invoice amount in EUR — already converted from Stripe's smallest unit (öre/cents) */
  amount: number
  /** When access will be blocked if payment isn't recovered */
  gracePeriodEndsAt: Date
  /** Direct link to /settings/billing */
  manageBillingUrl: string
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

export function PaymentFailedEmail({
  companyName,
  amount,
  gracePeriodEndsAt,
  manageBillingUrl,
}: PaymentFailedEmailProps) {
  return (
    <LagligEmailLayout
      preview={`Din betalning på ${formatCurrency(amount)} misslyckades — uppdatera betalsätt före ${formatDate(gracePeriodEndsAt)}.`}
    >
      <EmailIconCircle src={ICON_WARNING} tone="warning" />
      <div style={{ textAlign: 'center', margin: '0 0 12px 0' }}>
        <EmailBadge tone="warning">Betalning misslyckades</EmailBadge>
      </div>
      <EmailHeading>Vi kunde inte dra din betalning</EmailHeading>
      <EmailBody>
        Vi försökte dra <strong>{formatCurrency(amount)}</strong> från
        betalsättet kopplat till <strong>{companyName}</strong>, men
        transaktionen misslyckades.
      </EmailBody>
      <EmailBody>
        Du har fram till <strong>{formatDate(gracePeriodEndsAt)}</strong> att
        uppdatera betalsättet. Efter det datumet pausas åtkomsten till
        arbetsutrymmet tills betalningen är genomförd.
      </EmailBody>
      <EmailCta href={manageBillingUrl}>Uppdatera betalsätt</EmailCta>
    </LagligEmailLayout>
  )
}

export default PaymentFailedEmail

'use client'

/**
 * Story 5.4: Billing dashboard — client component for /settings/billing.
 *
 * Composition (top to bottom):
 *   1. Status banners (past-due, checkout-success)
 *   2. Current plan card — tier, billing cycle, payment-method link (Portal)
 *   3. Plan tiles — Solo/Team/Enterprise upgrade buttons (Checkout)
 *   4. Invoice history table — fetched from /api/billing/invoices
 *
 * Plan changes (downgrade, cancel) go through Stripe Customer Portal so we
 * don't reimplement Stripe's price-change UX or proration handling.
 */
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UsageWidget } from './usage-widget'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
} from 'lucide-react'

const TIER_LABELS = {
  TRIAL: 'Provperiod',
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
} as const

type Tier = keyof typeof TIER_LABELS

// Stripe subscription_status → user-facing Swedish label + Badge variant.
// Happy-path states (active/trialing) intentionally absent — no badge means
// no problem; the past-due alert banner handles the loud cases on its own.
const SUBSCRIPTION_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'destructive' | 'outline' }
> = {
  past_due: { label: 'Förfallen betalning', variant: 'destructive' },
  unpaid: { label: 'Obetald', variant: 'destructive' },
  canceled: { label: 'Uppsagd', variant: 'outline' },
  paused: { label: 'Pausad', variant: 'outline' },
  incomplete: { label: 'Ej slutförd', variant: 'outline' },
  incomplete_expired: { label: 'Utgången', variant: 'outline' },
}

// Stripe invoice.status → Swedish label.
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  open: 'Öppen',
  paid: 'Betald',
  void: 'Makulerad',
  uncollectible: 'Avskriven',
}

// Enterprise is sales-led — clicking the tile opens an external booking flow,
// not Stripe Checkout. TODO: replace with the real scheduling URL once the
// sales calendar is set up.
const ENTERPRISE_CONTACT_URL = 'https://cal.com/laglig/sales'

const PAID_TIERS: Array<{
  tier: Exclude<Tier, 'TRIAL'>
  price: string
  description: string
}> = [
  {
    tier: 'SOLO',
    price: '499 SEK / mån (ex moms)',
    description: 'För enskilda firmor',
  },
  {
    tier: 'TEAM',
    price: '1 299 SEK / mån (ex moms)',
    description: 'För team upp till 10',
  },
  {
    tier: 'ENTERPRISE',
    price: 'Anpassad',
    description: 'För större organisationer',
  },
]

// BILLING-001 (QA gate 5.4): tier ordering used to distinguish upgrade vs
// downgrade. Downgrades MUST go through Stripe Customer Portal — Checkout in
// mode:'subscription' creates a NEW subscription instead of swapping plans,
// which would double-bill the customer. Higher rank = more expensive.
const TIER_RANK: Record<Tier, number> = {
  TRIAL: 0,
  SOLO: 1,
  TEAM: 2,
  ENTERPRISE: 3,
}

interface Invoice {
  id: string
  number: string | null
  amount_due: number
  currency: string
  status: string | null
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
}

interface BillingDashboardProps {
  workspace: {
    id: string
    name: string
    subscriptionTier: Tier
    subscriptionStatus: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    paymentGracePeriodEndsAt: string | null
  }
  showPastDueBanner: boolean
  showCheckoutSuccess: boolean
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long' }).format(new Date(iso))

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100)

export function BillingDashboard({
  workspace,
  showPastDueBanner,
  showCheckoutSuccess,
}: BillingDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)

  const tierLabel =
    TIER_LABELS[workspace.subscriptionTier] ?? workspace.subscriptionTier
  const isTrial = workspace.subscriptionTier === 'TRIAL'
  const hasStripeCustomer = !!workspace.stripeCustomerId

  // BILLING-003 (QA gate 5.4 re-review): Stripe Checkout in mode:'subscription'
  // ALWAYS creates a new subscription — for upgrades AND downgrades. The
  // server's BILLING-001 guard (returns 409 SUBSCRIPTION_EXISTS) blocks every
  // such attempt when an active sub exists, so the UI must mirror that: ANY
  // plan change for an existing subscriber goes through Customer Portal, not
  // Checkout. Only the trial-to-first-paid case keeps the Checkout button.
  const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])
  const hasActiveSub =
    !!workspace.stripeSubscriptionId &&
    !!workspace.subscriptionStatus &&
    ACTIVE_STATUSES.has(workspace.subscriptionStatus)

  useEffect(() => {
    if (!hasStripeCustomer) return
    fetch('/api/billing/invoices')
      .then(async (res) => {
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as { invoices: Invoice[] }
        setInvoices(data.invoices)
      })
      .catch(() => setInvoicesError('Kunde inte hämta fakturor'))
  }, [hasStripeCustomer])

  const handleUpgrade = (tier: Exclude<Tier, 'TRIAL'>) => {
    startTransition(async () => {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        // eslint-disable-next-line no-alert
        alert(data.error ?? 'Kunde inte starta Checkout')
      }
    })
  }

  const handleManagePortal = () => {
    startTransition(async () => {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        // eslint-disable-next-line no-alert
        alert(data.error ?? 'Kunde inte öppna kundportalen')
      }
    })
  }

  return (
    <div className="space-y-6">
      {showPastDueBanner && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Betalning krävs</AlertTitle>
          <AlertDescription>
            Vi kunde inte dra din senaste betalning och frist har gått ut.
            Uppdatera betalsättet nedan för att återfå åtkomsten till
            arbetsutrymmet.
          </AlertDescription>
        </Alert>
      )}

      {showCheckoutSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Tack — din prenumeration är aktiv</AlertTitle>
          <AlertDescription>
            Det kan ta några sekunder innan all info synkas från Stripe. Ladda
            om sidan om något ser inaktuellt ut.
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Prenumeration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={isTrial ? 'secondary' : 'default'}>
              {tierLabel}
            </Badge>
            {(() => {
              const statusBadge = workspace.subscriptionStatus
                ? SUBSCRIPTION_STATUS_BADGE[workspace.subscriptionStatus]
                : undefined
              return statusBadge ? (
                <Badge variant={statusBadge.variant} className="text-xs">
                  {statusBadge.label}
                </Badge>
              ) : null
            })()}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {isTrial && workspace.trialEndsAt && (
              <div>
                <dt className="text-muted-foreground">Provperiod slutar</dt>
                <dd className="font-medium">
                  {formatDate(workspace.trialEndsAt)}
                </dd>
              </div>
            )}
            {workspace.currentPeriodEnd && (
              <div>
                <dt className="text-muted-foreground">Nästa fakturadatum</dt>
                <dd className="font-medium">
                  {formatDate(workspace.currentPeriodEnd)}
                </dd>
              </div>
            )}
            {workspace.paymentGracePeriodEndsAt && (
              <div>
                <dt className="text-muted-foreground">Frist för betalning</dt>
                <dd className="font-medium text-destructive">
                  {formatDate(workspace.paymentGracePeriodEndsAt)}
                </dd>
              </div>
            )}
          </dl>

          {hasStripeCustomer && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManagePortal}
              disabled={isPending}
            >
              Hantera betalsätt
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Story 5.5c: Usage widget — tokens, storage, seats */}
      <UsageWidget />

      {/* Plan tiles — upgrade flows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isTrial ? 'Välj nivå' : 'Byt nivå'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PAID_TIERS.map(({ tier, price, description }) => {
              const isCurrent = workspace.subscriptionTier === tier
              const isEnterprise = tier === 'ENTERPRISE'
              // BILLING-003: when an active sub exists, ALL plan changes (up
              // or down) must go through Portal — Checkout would create a 2nd
              // sub. TIER_RANK still drives the label so users see whether
              // the action is an upgrade or a downgrade.
              const currentRank = TIER_RANK[workspace.subscriptionTier]
              const tierRank = TIER_RANK[tier]
              const isUpgrade = tierRank > currentRank
              const portalLabel = isUpgrade
                ? 'Uppgradera via portal'
                : 'Nedgradera via portal'
              return (
                <div
                  key={tier}
                  className="rounded-lg border p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{TIER_LABELS[tier]}</span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Nuvarande
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {description}
                  </div>
                  <div className="text-lg font-medium">{price}</div>
                  {isCurrent ? (
                    <Button size="sm" variant="outline" disabled>
                      Aktiv
                    </Button>
                  ) : isEnterprise ? (
                    <Button asChild size="sm" variant="default">
                      <a
                        href={ENTERPRISE_CONTACT_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Boka samtal
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : hasActiveSub ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || !hasStripeCustomer}
                      onClick={handleManagePortal}
                      title="Planbyten hanteras via Stripe-portalen"
                    >
                      {portalLabel}
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isPending}
                      onClick={() => handleUpgrade(tier)}
                    >
                      {isTrial ? 'Välj nivå' : 'Uppgradera'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          {hasActiveSub && (
            <p className="mt-4 text-xs text-muted-foreground">
              Planbyten, paus och uppsägning hanteras via Stripe&apos;s
              kundportal — där sker ändringen direkt på din befintliga
              prenumeration med korrekt proration.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      {hasStripeCustomer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fakturor</CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesError && (
              <p className="text-sm text-destructive">{invoicesError}</p>
            )}
            {!invoicesError && invoices === null && (
              <p className="text-sm text-muted-foreground">Hämtar fakturor…</p>
            )}
            {invoices && invoices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Inga fakturor ännu.
              </p>
            )}
            {invoices && invoices.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fakturanr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Belopp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Länk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        {inv.number ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(new Date(inv.created * 1000).toISOString())}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatCurrency(inv.amount_due, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {(inv.status && INVOICE_STATUS_LABELS[inv.status]) ??
                            inv.status ??
                            'Okänd'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-sm text-primary hover:underline"
                          >
                            Visa
                          </a>
                        )}
                        {inv.invoice_pdf && (
                          <>
                            {' · '}
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-sm text-primary hover:underline"
                            >
                              PDF
                            </a>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.refresh()}
          disabled={isPending}
        >
          Uppdatera
        </Button>
      </div>
    </div>
  )
}

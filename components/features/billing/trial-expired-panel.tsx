'use client'

/**
 * Story 5.13: Trial-expired conversion panel.
 *
 * Rendered above the existing tile grid in BillingDashboard when the URL
 * carries ?reason=trial_expired (server-set by the workspace layout's
 * TRIAL_EXPIRED catch). Mirrors the 5.12 <TierCard> layout but emphasises
 * the user's picked tier and uses "Aktivera prenumeration" CTAs that call
 * the existing /api/billing/checkout endpoint.
 *
 * Enterprise tile shows "Boka samtal" → cal.com/laglig/sales (no Checkout
 * for Enterprise — sales-led per 5.4 + 5.12 precedent). For Enterprise
 * inquirers the framing copy acknowledges the open inquiry alongside the
 * Team self-serve option.
 *
 * Visual emphasis on picked tier uses TierCard's `selected` prop (primary
 * ring) rather than `recommended` (which would render the "Rekommenderas
 * för dig" badge — semantically wrong here; the user already picked the
 * tier at signup). A small "Din valda plan" overlay carries the framing.
 */
import { useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { TierCard } from './tier-card'

const ENTERPRISE_CONTACT_URL = 'https://cal.com/laglig/sales'

type PaidTier = 'SOLO' | 'TEAM' | 'ENTERPRISE'

interface TrialExpiredPanelProps {
  /** Workspace's picked tier from onboarding (Story 5.12). NULL on legacy
   *  rows pre-5.12 — falls back to SOLO emphasis. */
  pickedTier: PaidTier | null
  /** When non-null, workspace flagged Enterprise interest at signup —
   *  copy acknowledges the inquiry. */
  hasEnterpriseInquiry: boolean
}

const TIER_LABELS: Record<PaidTier, string> = {
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

/**
 * Order tiles with picked tier first so the recommended option is in the
 * primary visual + tab-order slot. Other tiles still selectable.
 */
function orderTiers(picked: PaidTier | null): PaidTier[] {
  const all: PaidTier[] = ['SOLO', 'TEAM', 'ENTERPRISE']
  if (!picked) return all
  return [picked, ...all.filter((t) => t !== picked)]
}

export function TrialExpiredPanel({
  pickedTier,
  hasEnterpriseInquiry,
}: TrialExpiredPanelProps) {
  const [isPending, startTransition] = useTransition()
  // Enterprise inquirers were placed on Team-tier limits during the trial
  // (per 5.12 — bounds COGS during the wait-for-sales window). The panel
  // uses Team as the highlighted self-serve option for them.
  const effectivePicked: PaidTier = hasEnterpriseInquiry
    ? 'TEAM'
    : (pickedTier ?? 'SOLO')

  const tiers = orderTiers(effectivePicked)

  const handleCheckout = (tier: Exclude<PaidTier, 'ENTERPRISE'>) => {
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

  return (
    <div className="space-y-6">
      <Alert
        variant="default"
        className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
      >
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Din provperiod är slut
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Aktivera din prenumeration för att fortsätta använda Laglig.se. Din
          data är kvar — välj en plan för att låsa upp åtkomsten igen.
          {hasEnterpriseInquiry && (
            <>
              {' '}
              Vi har inte hunnit prata med dig än om Enterprise — vill du komma
              igång med Team så länge?
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => {
          const isHighlighted = tier === effectivePicked
          // Enterprise = sales-led link (consistent with 5.4 + 5.12); Solo/Team
          // post to the existing /api/billing/checkout endpoint.
          const ctaProps =
            tier === 'ENTERPRISE'
              ? { ctaLabel: 'Boka samtal', ctaHref: ENTERPRISE_CONTACT_URL }
              : {
                  ctaLabel: isPending
                    ? 'Öppnar Checkout…'
                    : `Aktivera ${TIER_LABELS[tier]}`,
                  onSelect: () => handleCheckout(tier),
                }
          return (
            <div key={tier} className="relative">
              <TierCard
                tier={tier}
                selected={isHighlighted}
                dimmed={!isHighlighted}
                {...ctaProps}
              />
              {isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-medium text-white shadow">
                  Din valda plan
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Din workspace pausas efter 30 dagar och raderas efter 60 dagar utan
        aktivering. Aktivera nu för att behålla all data.
      </p>
    </div>
  )
}

'use client'

/**
 * Story 5.7: Billing Settings Tab (Placeholder)
 * Current plan display, upgrade options.
 * Full functionality deferred to Story 5.4 (Stripe integration).
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'
import type { WorkspaceData } from './settings-tabs'

interface BillingTabProps {
  workspace: WorkspaceData
}

const TIER_LABELS: Record<string, string> = {
  TRIAL: 'Provperiod',
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

export function BillingTab({ workspace }: BillingTabProps) {
  const tierLabel =
    TIER_LABELS[workspace.subscription_tier] || workspace.subscription_tier
  const isTrial = workspace.subscription_tier === 'TRIAL'
  const trialEndsAt = workspace.trial_ends_at
    ? new Date(workspace.trial_ends_at).toLocaleDateString('sv-SE')
    : null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Fakturering</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hantera din prenumeration och betalningsmetoder.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Nuvarande plan</p>
              <div className="mt-1 flex items-center gap-2">
                {isTrial ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {tierLabel}
                  </span>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {tierLabel}
                  </Badge>
                )}
                {isTrial && trialEndsAt && (
                  <span className="text-xs text-muted-foreground">
                    Upphör {trialEndsAt}
                  </span>
                )}
              </div>
            </div>
            <Button disabled size="sm">
              Uppgradera
            </Button>
          </div>

          <div className="rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              Fakturering och betalningsmetoder kommer snart att vara
              tillgängliga.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

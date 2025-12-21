'use client'

/**
 * Story 5.7: Integrations Settings Tab (Placeholder)
 * External service integrations.
 * Fortnox integration deferred to post-MVP.
 */

import { Plug } from 'lucide-react'

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plug className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Integrationer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Koppla externa tjänster till din arbetsplats.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 dark:border-amber-800 dark:from-amber-950/50 dark:to-orange-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
                <span className="text-lg font-bold text-slate-600 dark:text-slate-300">
                  Fx
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Fortnox</h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Kommer snart
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Synkronisera anställda och företagsdata med Fortnox.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

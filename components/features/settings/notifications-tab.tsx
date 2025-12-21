'use client'

/**
 * Story 5.7: Notifications Settings Tab (Placeholder)
 * Email and in-app notification preferences.
 * Full functionality deferred to Story 8.x (Change Monitoring).
 */

import { Switch } from '@/components/ui/switch'
import { Bell } from 'lucide-react'

export function NotificationsTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Aviseringar</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hantera dina aviseringsinställningar.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {/* Email Notifications */}
          <div>
            <h3 className="text-sm font-medium">E-postaviseringar</h3>
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Daglig sammanfattning</p>
                  <p className="text-xs text-muted-foreground">
                    Få en daglig sammanfattning av lagändringar
                  </p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Veckovis sammanfattning</p>
                  <p className="text-xs text-muted-foreground">
                    Få en veckovis sammanfattning av lagändringar
                  </p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Direkta ändringsaviseringar</p>
                  <p className="text-xs text-muted-foreground">
                    Få meddelande direkt när en lag ändras
                  </p>
                </div>
                <Switch disabled />
              </div>
            </div>
          </div>

          {/* In-app Notifications */}
          <div>
            <h3 className="text-sm font-medium">Appaviseringar</h3>
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Visa aviseringar i appen</p>
                  <p className="text-xs text-muted-foreground">
                    Visa notiser för lagändringar i appen
                  </p>
                </div>
                <Switch disabled />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              Aviseringsinställningar kommer snart att vara tillgängliga.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

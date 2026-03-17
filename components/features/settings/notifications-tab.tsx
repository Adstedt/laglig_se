'use client'

/**
 * Story 6.11: Notification Preferences Settings Tab
 * Functional controls for toggling notification types on/off.
 */

import { useEffect, useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Bell, Loader2 } from 'lucide-react'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type UpdatePreferencesInput,
} from '@/app/actions/notifications'

interface PreferenceToggle {
  key: keyof UpdatePreferencesInput
  label: string
  description: string
}

const TASK_TOGGLES: PreferenceToggle[] = [
  {
    key: 'task_assigned_enabled',
    label: 'Tilldelning',
    description: 'När en uppgift tilldelas dig',
  },
  {
    key: 'task_due_soon_enabled',
    label: 'Förfaller snart',
    description: 'Påminnelse 3 dagar innan förfallodatum',
  },
  {
    key: 'task_overdue_enabled',
    label: 'Förfallen',
    description: 'När en uppgift passerat sitt förfallodatum',
  },
  {
    key: 'comment_added_enabled',
    label: 'Kommentarer',
    description: 'Ny kommentar på uppgifter du skapat eller tilldelats',
  },
  {
    key: 'mention_enabled',
    label: 'Omnämnanden',
    description: 'När någon @nämner dig i en kommentar',
  },
  {
    key: 'status_changed_enabled',
    label: 'Statusändringar',
    description: 'När status ändras på uppgifter du skapat',
  },
  {
    key: 'weekly_digest_enabled',
    label: 'Veckosammanfattning',
    description: 'Veckans uppgifter sammanfattade varje söndag',
  },
]

const LAW_CHANGE_TOGGLES: PreferenceToggle[] = [
  {
    key: 'amendment_detected_enabled',
    label: 'Lagändring upptäckt',
    description: 'När en lag du bevakar ändras',
  },
  {
    key: 'law_repealed_enabled',
    label: 'Lag upphävd',
    description: 'När en lag du bevakar upphävs',
  },
  {
    key: 'ruling_cited_enabled',
    label: 'Nytt avgörande',
    description: 'Nytt rättsfall som berör dina lagar',
  },
  {
    key: 'amendment_reminder_enabled',
    label: 'Ändringspåminnelse',
    description: 'Påminnelse om kommande lagändringar',
  },
]

export function NotificationsTab() {
  const [preferences, setPreferences] = useState<Record<
    string,
    boolean
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const result = await getNotificationPreferences()
      if (result.success && result.data) {
        const prefs: Record<string, boolean> = {}
        for (const toggle of [...TASK_TOGGLES, ...LAW_CHANGE_TOGGLES]) {
          prefs[toggle.key] = (result.data as Record<string, unknown>)[
            toggle.key
          ] as boolean
        }
        prefs.email_enabled = result.data.email_enabled
        setPreferences(prefs)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleToggle = (key: keyof UpdatePreferencesInput, value: boolean) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: value }
    setPreferences(updated)

    startTransition(async () => {
      await updateNotificationPreferences({ [key]: value })
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          {/* Global email toggle */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_enabled" className="text-sm font-medium">
                  E-postaviseringar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Aktivera eller inaktivera alla e-postnotifieringar
                </p>
              </div>
              <Switch
                id="email_enabled"
                checked={preferences?.email_enabled ?? true}
                onCheckedChange={(v) => handleToggle('email_enabled', v)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Task notification toggles */}
          <div>
            <h3 className="text-sm font-medium">Uppgifter</h3>
            <div className="mt-2.5 space-y-2.5">
              {TASK_TOGGLES.map((toggle) => (
                <div
                  key={toggle.key}
                  className="flex items-center justify-between"
                >
                  <div>
                    <Label htmlFor={toggle.key} className="text-sm">
                      {toggle.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {toggle.description}
                    </p>
                  </div>
                  <Switch
                    id={toggle.key}
                    checked={preferences?.[toggle.key] ?? true}
                    onCheckedChange={(v) => handleToggle(toggle.key, v)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Law change notification toggles */}
          <div>
            <h3 className="text-sm font-medium">Lagändringar</h3>
            <div className="mt-2.5 space-y-2.5">
              {LAW_CHANGE_TOGGLES.map((toggle) => (
                <div
                  key={toggle.key}
                  className="flex items-center justify-between"
                >
                  <div>
                    <Label htmlFor={toggle.key} className="text-sm">
                      {toggle.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {toggle.description}
                    </p>
                  </div>
                  <Switch
                    id={toggle.key}
                    checked={preferences?.[toggle.key] ?? true}
                    onCheckedChange={(v) => handleToggle(toggle.key, v)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

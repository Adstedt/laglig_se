'use client'

/**
 * Per-category consent dialog. Opens from the footer "Cookieinställningar"
 * link or the banner "Inställningar" button.
 *
 * Two categories surfaced today — Nödvändiga (locked on) and Analys.
 * Add Marknadsföring here when we ship ads; the gtag mapping in
 * `lib/consent/gtag.ts` already includes the four ad_* signals (currently
 * hardcoded to denied).
 */

import { useEffect, useState } from 'react'
import { Lock, BarChart3 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useConsent } from '@/components/providers/consent-provider'

export function ConsentSettingsDialog() {
  const {
    categories,
    settingsOpen,
    setSettingsOpen,
    acceptAll,
    rejectAll,
    update,
  } = useConsent()
  const [analytics, setAnalytics] = useState(categories.analytics)

  // Re-sync local toggle state whenever the dialog opens.
  useEffect(() => {
    if (settingsOpen) setAnalytics(categories.analytics)
  }, [settingsOpen, categories.analytics])

  function handleSave() {
    update({ analytics })
    setSettingsOpen(false)
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-safiro text-xl tracking-tight">
            Cookieinställningar
          </DialogTitle>
          <DialogDescription>
            Välj vilka cookies du tillåter. Du kan ändra ditt val när som helst
            via länken i sidfoten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <CategoryRow
            icon={<Lock className="h-4 w-4 text-muted-foreground" />}
            title="Nödvändiga"
            description="Krävs för att tjänsten ska fungera — inloggning, val av arbetsyta och säkerhet. Kan inte stängas av."
            checked
            disabled
            onCheckedChange={() => {}}
          />

          <Separator />

          <CategoryRow
            icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
            title="Analys"
            description="Anonym besöksstatistik via Google Analytics. Hjälper oss förstå hur sidan används och prioritera förbättringar."
            checked={analytics}
            disabled={false}
            onCheckedChange={setAnalytics}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={rejectAll}>
              Avvisa alla
            </Button>
            <Button variant="ghost" size="sm" onClick={acceptAll}>
              Acceptera alla
            </Button>
          </div>
          <Button size="sm" onClick={handleSave}>
            Spara val
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CategoryRowProps {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (_v: boolean) => void
}

function CategoryRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: CategoryRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{title}</p>
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            aria-label={title}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}

'use client'

/**
 * Story 6.6: Quick Links Box
 * Quick navigation links including AI chat toggle
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { useSplitPanelModalOptional } from '@/components/shared/split-panel-modal/context'

export function QuickLinksBox() {
  const shell = useSplitPanelModalOptional()
  const canToggleChat = shell?.hasChat ?? false

  if (!canToggleChat || !shell) return null

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Snabblänkar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
          onClick={shell.openChat}
        >
          <LexaIcon size={16} className="invert-0 dark:invert" />
          Fråga assistenten om uppgiften
        </Button>
      </CardContent>
    </Card>
  )
}

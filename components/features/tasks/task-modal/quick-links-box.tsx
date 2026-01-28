'use client'

/**
 * Story 6.6: Quick Links Box
 * Quick navigation links including AI chat toggle
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LexaIcon } from '@/components/ui/lexa-icon'

interface QuickLinksBoxProps {
  onAiChatToggle: () => void
}

export function QuickLinksBox({ onAiChatToggle }: QuickLinksBoxProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Snabblänkar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onAiChatToggle}
        >
          <LexaIcon size={16} />
          Fråga Lexa om uppgiften
        </Button>
      </CardContent>
    </Card>
  )
}

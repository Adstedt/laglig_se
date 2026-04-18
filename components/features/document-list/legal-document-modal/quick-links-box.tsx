'use client'

/**
 * Story 6.3: Quick Links Box
 * Navigation links to full law page and AI chat
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import Link from 'next/link'
import { useSplitPanelModalOptional } from '@/components/shared/split-panel-modal/context'

interface QuickLinksBoxProps {
  slug: string
  contentType: string
  documentNumber: string
  listItemId: string
}

function getDocumentUrl(contentType: string, slug: string): string {
  if (contentType === 'EU_REGULATION' || contentType === 'EU_DIRECTIVE') {
    return `/browse/eu/${slug}`
  }
  if (contentType === 'AGENCY_REGULATION') {
    return `/browse/foreskrifter/${slug}`
  }
  return `/browse/lagar/${slug}`
}

function getDocumentLabel(contentType: string): string {
  if (contentType === 'AGENCY_REGULATION') return 'Visa fullständig föreskrift'
  return 'Visa fullständig lag'
}

export function QuickLinksBox({
  slug,
  contentType,
  documentNumber,
  listItemId: _listItemId,
}: QuickLinksBoxProps) {
  const docUrl = getDocumentUrl(contentType, slug)
  const docLabel = getDocumentLabel(contentType)
  const shell = useSplitPanelModalOptional()
  const canToggleChat = shell?.hasChat ?? false

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Snabblänkar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* View full document */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link href={docUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            {docLabel}
          </Link>
        </Button>

        {/* Ask AI about law - toggles in-modal AI chat when inside a shell with chat support; otherwise links to the standalone AI chat page */}
        {canToggleChat && shell ? (
          <Button
            size="sm"
            className="w-full justify-start bg-foreground text-background hover:bg-foreground/90"
            onClick={shell.openChat}
          >
            <LexaIcon size={16} className="mr-2 invert-0 dark:invert" />
            Fråga Lexa om lagen
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full justify-start bg-foreground text-background hover:bg-foreground/90"
            asChild
          >
            <Link
              href={`/ai-chat?context=${encodeURIComponent(documentNumber)}`}
            >
              <LexaIcon size={16} className="mr-2 invert-0 dark:invert" />
              Fråga Lexa om lagen
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

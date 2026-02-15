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

interface QuickLinksBoxProps {
  slug: string
  contentType: string
  documentNumber: string
  listItemId: string
  onAiChatToggle?: (() => void) | undefined
}

function getDocumentUrl(contentType: string, slug: string): string {
  if (contentType.startsWith('COURT_CASE_')) {
    const courtCode = contentType.replace('COURT_CASE_', '').toLowerCase()
    return `/browse/rattsfall/${courtCode}/${slug}`
  }
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
  if (contentType.startsWith('COURT_CASE_'))
    return 'Visa fullständigt rättsfall'
  return 'Visa fullständig lag'
}

export function QuickLinksBox({
  slug,
  contentType,
  documentNumber,
  listItemId: _listItemId,
  onAiChatToggle,
}: QuickLinksBoxProps) {
  const docUrl = getDocumentUrl(contentType, slug)
  const docLabel = getDocumentLabel(contentType)

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

        {/* Ask AI about law - toggles in-modal AI chat on desktop, links to AI chat page on mobile */}
        {onAiChatToggle ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onAiChatToggle}
          >
            <LexaIcon size={16} className="mr-2" />
            Fråga Lexa om lagen
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            asChild
          >
            <Link
              href={`/ai-chat?context=${encodeURIComponent(documentNumber)}`}
            >
              <LexaIcon size={16} className="mr-2" />
              Fråga Lexa om lagen
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

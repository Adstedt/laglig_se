'use client'

/**
 * Story 6.3: Quick Links Box
 * Navigation links to full law page and AI chat
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, MessageSquare } from 'lucide-react'
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
  return `/browse/lagar/${slug}`
}

export function QuickLinksBox({
  slug,
  contentType,
  documentNumber,
  listItemId: _listItemId,
  onAiChatToggle,
}: QuickLinksBoxProps) {
  const lawUrl = getDocumentUrl(contentType, slug)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Snabblänkar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* View full law */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          asChild
        >
          <Link href={lawUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visa fullständig lag
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
            <MessageSquare className="h-4 w-4 mr-2" />
            Fråga AI om lagen
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
              <MessageSquare className="h-4 w-4 mr-2" />
              Fråga AI om lagen
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

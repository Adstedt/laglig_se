'use client'

import { useCallback, useMemo, useState } from 'react'
import { FutureAmendmentsBanner } from '@/components/features/law'
import { LawContentWrapper } from '@/components/features/law-content-wrapper'
import { DocumentContent } from '@/components/features/document-content'
import { rewriteLinksForWorkspace } from '@/lib/linkify/rewrite-links'

interface LawDocumentContentProps {
  htmlContent: string
  fallbackText?: string | null
  sourceUrl?: string | null
  isLawNotYetInForce?: boolean
  isWorkspace?: boolean
}

/**
 * SFS law content renderer — wraps the shared DocumentContent with the
 * FutureAmendmentsBanner (surfaces discovered /Träder i kraft.../ dates
 * from the HTML at the top of the page) and the law-specific
 * LawContentWithHighlights post-processor.
 *
 * Replaces the former `LawSectionWithBanner` / `Card`-wrapped Lagtext section.
 */
export function LawDocumentContent({
  htmlContent,
  fallbackText,
  sourceUrl,
  isLawNotYetInForce = false,
  isWorkspace = false,
}: LawDocumentContentProps) {
  const [futureAmendments, setFutureAmendments] = useState<
    { date: string; formattedDate: string }[]
  >([])

  const handleFutureAmendmentsFound = useCallback(
    (amendments: { date: string; formattedDate: string }[]) => {
      if (amendments.length > 0 && futureAmendments.length === 0) {
        setFutureAmendments(amendments)
      }
    },
    [futureAmendments.length]
  )

  const processedHtml = useMemo(() => {
    if (!htmlContent) return ''
    return isWorkspace ? rewriteLinksForWorkspace(htmlContent) : htmlContent
  }, [htmlContent, isWorkspace])

  const hasContent = !!htmlContent || !!fallbackText

  return (
    <>
      {!isLawNotYetInForce && (
        <FutureAmendmentsBanner amendments={futureAmendments} />
      )}

      {hasContent ? (
        <DocumentContent className="rounded-lg bg-card p-6 md:p-10">
          <LawContentWrapper
            htmlContent={processedHtml}
            fallbackText={fallbackText}
            onFutureAmendmentsFound={handleFutureAmendmentsFound}
          />
        </DocumentContent>
      ) : (
        <p className="italic text-muted-foreground py-8 text-center">
          Ingen lagtext tillgänglig.{' '}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Läs på Riksdagen →
            </a>
          )}
        </p>
      )}
    </>
  )
}

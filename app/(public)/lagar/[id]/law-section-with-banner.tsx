'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FutureAmendmentsBanner } from '@/components/features/law'
import { StickyDocNav } from '@/components/features/paragraf-toc'
import { LawContentWrapper } from './law-content-wrapper'

interface LawSectionWithBannerProps {
  htmlContent: string
  fallbackText?: string | null
  sourceUrl?: string | null
  isLawNotYetInForce?: boolean
}

export function LawSectionWithBanner({
  htmlContent,
  fallbackText,
  sourceUrl,
  isLawNotYetInForce,
}: LawSectionWithBannerProps) {
  const articleRef = useRef<HTMLDivElement>(null)
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

  return (
    <>
      {!isLawNotYetInForce && (
        <FutureAmendmentsBanner amendments={futureAmendments} />
      )}

      <Card className="mb-8">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Lagtext</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={articleRef} className="legal-document p-6 md:p-8">
            {htmlContent || fallbackText ? (
              <LawContentWrapper
                htmlContent={htmlContent}
                fallbackText={fallbackText}
                onFutureAmendmentsFound={handleFutureAmendmentsFound}
              />
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
          </div>
        </CardContent>
      </Card>

      {/* Fixed-position sidebar nav — self-positioning, auto-hides when no room */}
      <StickyDocNav containerRef={articleRef} />
    </>
  )
}

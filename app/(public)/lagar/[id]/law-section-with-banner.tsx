'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FutureAmendmentsBanner } from '@/components/features/law'
import { LawContentWrapper } from './law-content-wrapper'

interface LawSectionWithBannerProps {
  htmlContent: string
  fallbackText?: string | null
  sourceUrl?: string | null
  isLawNotYetInForce?: boolean
}

export function LawSectionWithBanner({ htmlContent, fallbackText, sourceUrl, isLawNotYetInForce }: LawSectionWithBannerProps) {
  const [futureAmendments, setFutureAmendments] = useState<{ date: string; formattedDate: string }[]>([])

  const handleFutureAmendmentsFound = useCallback((amendments: { date: string; formattedDate: string }[]) => {
    // Only update if we found new amendments (prevent infinite loop)
    if (amendments.length > 0 && futureAmendments.length === 0) {
      setFutureAmendments(amendments)
    }
  }, [futureAmendments.length])

  return (
    <>
      {/* Banner appears ABOVE the card when future amendments are found */}
      {/* Don't show if the entire law hasn't entered into force yet - that's redundant */}
      {!isLawNotYetInForce && <FutureAmendmentsBanner amendments={futureAmendments} />}

      {/* Law Content Card */}
      <Card className="mb-8">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">Lagtext</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <article className="legal-document p-6 md:p-8">
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
          </article>
        </CardContent>
      </Card>
    </>
  )
}

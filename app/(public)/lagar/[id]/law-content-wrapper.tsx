'use client'

import { LawContentWithHighlights } from '@/components/features/law'

export interface LawContentWrapperProps {
  htmlContent: string
  fallbackText?: string | null | undefined
  onFutureAmendmentsFound?: (
    _amendments: { date: string; formattedDate: string }[]
  ) => void
}

export function LawContentWrapper({
  htmlContent,
  fallbackText,
  onFutureAmendmentsFound,
}: LawContentWrapperProps) {
  if (!htmlContent && !fallbackText) {
    return (
      <p className="italic text-muted-foreground py-8 text-center">
        Ingen lagtext tillgänglig.
      </p>
    )
  }

  return (
    <>
      {htmlContent ? (
        onFutureAmendmentsFound ? (
          <LawContentWithHighlights
            htmlContent={htmlContent}
            onFutureAmendmentsFound={onFutureAmendmentsFound}
          />
        ) : (
          <LawContentWithHighlights htmlContent={htmlContent} />
        )
      ) : fallbackText ? (
        <div className="whitespace-pre-wrap font-serif">{fallbackText}</div>
      ) : null}
    </>
  )
}

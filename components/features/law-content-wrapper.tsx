'use client'

import { LawContentWithHighlights } from '@/components/features/law'

export interface LawContentWrapperProps {
  htmlContent: string
  fallbackText?: string | null | undefined
  onFutureAmendmentsFound?: (
    _amendments: { date: string; formattedDate: string }[]
  ) => void
}

/**
 * Renders SFS law HTML with future-amendment highlights applied via DOM
 * post-processing (LawContentWithHighlights). Used by both:
 *  - The full law pages (composed inside DocumentContent)
 *  - The legal-document-modal accordion (LagtextSection)
 *
 * Lives in components/features/ so the modal does not depend on the public
 * law route directory.
 */
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

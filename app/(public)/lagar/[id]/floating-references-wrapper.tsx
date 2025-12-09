'use client'

import { FloatingReferencesButton } from '@/components/features/cross-references'

interface FloatingReferencesWrapperProps {
  courtCaseCount: number
  directiveCount: number
}

export function FloatingReferencesWrapper({
  courtCaseCount,
  directiveCount,
}: FloatingReferencesWrapperProps) {
  const handleScrollToReferences = () => {
    // Scroll to the related documents section at the top
    const element = document.querySelector('[data-references-section]')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Fallback: scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <FloatingReferencesButton
      courtCaseCount={courtCaseCount}
      directiveCount={directiveCount}
      onScrollToReferences={handleScrollToReferences}
    />
  )
}

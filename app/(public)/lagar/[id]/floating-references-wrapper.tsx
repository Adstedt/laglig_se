'use client'

import { FloatingReferencesButton } from '@/components/features/cross-references'

interface FloatingReferencesWrapperProps {
  directiveCount: number
}

export function FloatingReferencesWrapper({
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
      directiveCount={directiveCount}
      onScrollToReferences={handleScrollToReferences}
    />
  )
}

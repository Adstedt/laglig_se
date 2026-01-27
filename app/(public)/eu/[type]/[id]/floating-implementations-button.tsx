'use client'

import { FileText } from 'lucide-react'
import { FloatingRelatedButton } from '@/components/features/content'

interface FloatingImplementationsButtonProps {
  implementationCount: number
}

export function FloatingImplementationsButton({
  implementationCount,
}: FloatingImplementationsButtonProps) {
  const handleScrollToImplementations = () => {
    // Scroll to the Swedish implementations section
    const element = document.querySelector('[data-implementations-section]')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <FloatingRelatedButton
      count={implementationCount}
      label="svenska lagar"
      icon={FileText}
      onScrollToRelated={handleScrollToImplementations}
      colorClass="bg-purple-600 hover:bg-purple-700"
    />
  )
}

'use client'

import { FileText } from 'lucide-react'
import { FloatingRelatedButton } from '@/components/features/content'

interface FloatingLawsButtonProps {
  lawCount: number
}

export function FloatingLawsButton({ lawCount }: FloatingLawsButtonProps) {
  const handleScrollToLaws = () => {
    // Scroll to the cited laws section
    const element = document.querySelector('[data-cited-laws-section]')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <FloatingRelatedButton
      count={lawCount}
      label="citerade lagar"
      icon={FileText}
      onScrollToRelated={handleScrollToLaws}
      colorClass="bg-amber-600 hover:bg-amber-700"
    />
  )
}

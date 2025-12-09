'use client'

import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingCitedLawsWrapperProps {
  lawCount: number
}

export function FloatingCitedLawsWrapper({
  lawCount,
}: FloatingCitedLawsWrapperProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling 600px
      setIsVisible(window.scrollY > 600)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleScrollToReferences = () => {
    // Scroll to the cited laws section at the top
    const element = document.querySelector('[data-cited-laws-section]')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Fallback: scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (lawCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-24 right-4 z-40 transition-all duration-300',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-16 opacity-0 pointer-events-none'
      )}
    >
      <Button
        size="lg"
        className={cn(
          'rounded-full shadow-lg h-14 gap-2 transition-all',
          'bg-amber-600 hover:bg-amber-700 text-white'
        )}
        onClick={handleScrollToReferences}
      >
        <FileText className="h-5 w-5" />
        <span className="font-semibold">{lawCount}</span>
        <span className="sr-only sm:not-sr-only text-sm">citerade lagar</span>
      </Button>
    </div>
  )
}

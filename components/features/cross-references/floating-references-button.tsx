'use client'

import { useState, useEffect } from 'react'
import { Scale, Landmark, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingReferencesButtonProps {
  courtCaseCount: number
  directiveCount: number
  onScrollToReferences: () => void
}

export function FloatingReferencesButton({
  courtCaseCount,
  directiveCount,
  onScrollToReferences,
}: FloatingReferencesButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const totalCount = courtCaseCount + directiveCount

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling 600px (past header and summary section)
      const shouldShow = window.scrollY > 600
      setIsVisible(shouldShow)

      // Collapse when near top
      if (window.scrollY < 400) {
        setIsExpanded(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (totalCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-24 right-4 z-40 transition-all duration-300',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-16 opacity-0 pointer-events-none'
      )}
    >
      <div className="flex flex-col items-end gap-2">
        {/* Expanded panel */}
        <div
          className={cn(
            'bg-card rounded-lg shadow-lg border p-3 transition-all duration-200 origin-bottom-right',
            isExpanded
              ? 'scale-100 opacity-100'
              : 'scale-95 opacity-0 pointer-events-none h-0 p-0 overflow-hidden'
          )}
        >
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Relaterade dokument
          </p>
          <div className="flex flex-col gap-1.5">
            {courtCaseCount > 0 && (
              <button
                onClick={onScrollToReferences}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                <Scale className="h-4 w-4" />
                {courtCaseCount} rättsfall
              </button>
            )}
            {directiveCount > 0 && (
              <button
                onClick={onScrollToReferences}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 hover:underline"
              >
                <Landmark className="h-4 w-4" />
                {directiveCount} EU-direktiv
              </button>
            )}
          </div>
        </div>

        {/* Main FAB button */}
        <Button
          size="lg"
          className={cn(
            'rounded-full shadow-lg h-14 gap-2 transition-all',
            'bg-blue-600 hover:bg-blue-700 text-white',
            isExpanded && 'ring-2 ring-blue-300'
          )}
          onClick={() => {
            if (isExpanded) {
              onScrollToReferences()
              setIsExpanded(false)
            } else {
              setIsExpanded(true)
            }
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only">Till toppen</span>
            </>
          ) : (
            <>
              <Scale className="h-5 w-5" />
              <span className="font-semibold">{totalCount}</span>
              <span className="sr-only sm:not-sr-only text-sm">relaterade</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

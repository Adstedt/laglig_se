'use client'

import { useState, useEffect } from 'react'
import { FileText, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingRelatedButtonProps {
  count: number
  label: string
  icon?: LucideIcon
  onScrollToRelated: () => void
  colorClass?: string // e.g., 'bg-blue-600 hover:bg-blue-700'
}

export function FloatingRelatedButton({
  count,
  label,
  icon: Icon = FileText,
  onScrollToRelated,
  colorClass = 'bg-blue-600 hover:bg-blue-700',
}: FloatingRelatedButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show button after scrolling 600px
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

  if (count === 0) return null

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
          'rounded-full shadow-lg h-14 gap-2 transition-all text-white',
          colorClass,
          isExpanded && 'ring-2 ring-blue-300'
        )}
        onClick={() => {
          if (isExpanded) {
            onScrollToRelated()
            setIsExpanded(false)
          } else {
            setIsExpanded(true)
            // Auto-scroll after a brief moment
            setTimeout(() => {
              onScrollToRelated()
              setIsExpanded(false)
            }, 200)
          }
        }}
      >
        <Icon className="h-5 w-5" />
        <span className="font-semibold">{count}</span>
        <span className="sr-only sm:not-sr-only text-sm">{label}</span>
      </Button>
    </div>
  )
}

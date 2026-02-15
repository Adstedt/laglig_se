'use client'

import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 500)
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!isVisible) return null

  return (
    <Button
      variant="secondary"
      size="icon"
      className="fixed bottom-6 right-20 z-40 shadow-lg rounded-full hover:scale-110 transition-transform"
      onClick={scrollToTop}
      aria-label="Tillbaka till toppen"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  )
}

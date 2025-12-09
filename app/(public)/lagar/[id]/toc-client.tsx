'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TocItem {
  id: string
  text: string
  type: 'section' | 'paragraph'
}

export function LawTableOfContents() {
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    // Extract TOC from rendered content
    const legalDoc = document.querySelector('.legal-document')
    if (!legalDoc) return

    const items: TocItem[] = []

    // Find all h2 (sections) and anchors with paragraph numbers
    const elements = legalDoc.querySelectorAll('h2, a[name^="P"], a.paragraf')

    elements.forEach((el, index) => {
      if (el.tagName === 'H2') {
        const text = el.textContent?.trim() || ''
        const id = el.id || `section-${index}`
        if (!el.id) el.id = id
        items.push({ id, text, type: 'section' })
      } else if (el.tagName === 'A') {
        // Paragraph anchor - look for § text
        const name = el.getAttribute('name') || ''
        const boldEl =
          el.querySelector('b') || el.nextElementSibling?.querySelector('b')
        let text = boldEl?.textContent?.trim() || ''

        // If no text found, check for pattern like "1 §"
        if (!text && name.startsWith('P')) {
          const paragraphNum = name.replace('P', '')
          text = `${paragraphNum} §`
        }

        if (text && name) {
          items.push({ id: name, text, type: 'paragraph' })
        }
      }
    })

    // Only show if we have meaningful content
    if (items.length > 3) {
      setTocItems(items)
    }
  }, [])

  useEffect(() => {
    // Track active section on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(
              entry.target.id || entry.target.getAttribute('name') || ''
            )
          }
        })
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )

    tocItems.forEach((item) => {
      const el =
        document.getElementById(item.id) ||
        document.querySelector(`[name="${item.id}"]`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [tocItems])

  const scrollToElement = (id: string) => {
    const el =
      document.getElementById(id) || document.querySelector(`[name="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setIsOpen(false)
    }
  }

  if (tocItems.length === 0) return null

  // Group items: sections first, then paragraphs under each section
  const sections = tocItems.filter((i) => i.type === 'section')
  const paragraphs = tocItems.filter((i) => i.type === 'paragraph')

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-20 right-4 z-40 lg:hidden shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <List className="h-4 w-4 mr-2" />
        Innehåll
      </Button>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Stäng meny"
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Innehåll</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TocList
              sections={sections}
              paragraphs={paragraphs}
              activeId={activeId}
              onSelect={scrollToElement}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar - positioned to the right of content, only on xl screens */}
      <aside
        className="hidden xl:block fixed top-24 w-56 max-h-[calc(100vh-8rem)] overflow-y-auto bg-card/95 backdrop-blur-sm border rounded-lg shadow-sm p-4"
        style={{ left: 'calc(50% + 28rem)' }}
      >
        <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
          <List className="h-4 w-4" />
          Innehåll
        </h3>
        <TocList
          sections={sections}
          paragraphs={paragraphs}
          activeId={activeId}
          onSelect={scrollToElement}
        />
      </aside>
    </>
  )
}

function TocList({
  sections,
  paragraphs,
  activeId,
  onSelect,
}: {
  sections: TocItem[]
  paragraphs: TocItem[]
  activeId: string
  onSelect: (_id: string) => void
}) {
  return (
    <nav className="space-y-1 text-sm">
      {sections.length > 0 && (
        <div className="space-y-1 mb-3">
          {sections.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                'block w-full text-left px-2 py-1.5 rounded-md transition-colors hover:bg-muted',
                activeId === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
      )}

      {paragraphs.length > 0 && (
        <>
          <div className="border-t pt-2 mt-2">
            <span className="text-xs text-muted-foreground px-2">
              Paragrafer
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {paragraphs.slice(0, 40).map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors hover:bg-muted text-center',
                  activeId === item.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground'
                )}
                title={item.text}
              >
                {item.text.replace(' §', '§')}
              </button>
            ))}
          </div>
          {paragraphs.length > 40 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              +{paragraphs.length - 40} fler
            </p>
          )}
        </>
      )}
    </nav>
  )
}

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

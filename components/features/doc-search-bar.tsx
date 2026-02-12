'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const HIGHLIGHT_CLASS = 'doc-search-highlight'
const ACTIVE_CLASS = 'doc-search-highlight-active'
const DEBOUNCE_MS = 200

/**
 * In-document search bar for the legal document reader.
 * Highlights matching text using TreeWalker and allows navigating between matches.
 */
export function DocSearchBar({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<HTMLElement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Store original text node state for cleanup
  const originalNodesRef = useRef<Map<HTMLElement, string>>(new Map())

  // Clear all highlights and restore original text nodes
  const clearHighlights = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const marks = container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`)
    marks.forEach((mark) => {
      const parent = mark.parentNode
      if (parent) {
        parent.replaceChild(
          document.createTextNode(mark.textContent || ''),
          mark
        )
        parent.normalize() // merge adjacent text nodes
      }
    })

    originalNodesRef.current.clear()
    setMatches([])
    setCurrentIndex(0)
  }, [containerRef])

  // Highlight all matches of the given query in the container
  const highlightMatches = useCallback(
    (searchQuery: string) => {
      clearHighlights()

      const container = containerRef.current
      if (!container || !searchQuery.trim()) return

      const normalizedQuery = searchQuery.toLowerCase()
      const foundMarks: HTMLElement[] = []

      // Walk all text nodes inside the container
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            // Skip text inside script/style/mark tags
            const parent = node.parentElement
            if (!parent) return NodeFilter.FILTER_REJECT
            const tag = parent.tagName.toLowerCase()
            if (tag === 'script' || tag === 'style' || tag === 'mark') {
              return NodeFilter.FILTER_REJECT
            }
            return NodeFilter.FILTER_ACCEPT
          },
        }
      )

      const textNodes: Text[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text)
      }

      // Process each text node — split at match boundaries, wrap matches in <mark>
      for (const textNode of textNodes) {
        const text = textNode.textContent || ''
        const lowerText = text.toLowerCase()
        const firstIdx = lowerText.indexOf(normalizedQuery)
        if (firstIdx === -1) continue

        const parent = textNode.parentNode
        if (!parent) continue

        // Build fragments by splitting at match positions
        const frag = document.createDocumentFragment()
        let lastEnd = 0
        let searchFrom = 0

        while (searchFrom < lowerText.length) {
          const idx = lowerText.indexOf(normalizedQuery, searchFrom)
          if (idx === -1) break

          // Add text before the match
          if (idx > lastEnd) {
            frag.appendChild(document.createTextNode(text.slice(lastEnd, idx)))
          }

          // Create highlight mark
          const mark = document.createElement('mark')
          mark.className = HIGHLIGHT_CLASS
          mark.textContent = text.slice(idx, idx + normalizedQuery.length)
          frag.appendChild(mark)
          foundMarks.push(mark)

          lastEnd = idx + normalizedQuery.length
          searchFrom = lastEnd
        }

        // Add remaining text after last match
        if (lastEnd < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastEnd)))
        }

        parent.replaceChild(frag, textNode)
      }

      setMatches(foundMarks)
      setCurrentIndex(foundMarks.length > 0 ? 0 : -1)

      // Activate the first match
      if (foundMarks.length > 0) {
        foundMarks[0]!.classList.add(ACTIVE_CLASS)
        foundMarks[0]!.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    },
    [containerRef, clearHighlights]
  )

  // Navigate to a specific match index
  const navigateToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return

      // Wrap around
      let newIndex = index
      if (newIndex < 0) newIndex = matches.length - 1
      if (newIndex >= matches.length) newIndex = 0

      // Remove active from previous
      matches[currentIndex]?.classList.remove(ACTIVE_CLASS)

      // Add active to new
      const match = matches[newIndex]
      if (!match) return
      match.classList.add(ACTIVE_CLASS)
      match.scrollIntoView({ block: 'center', behavior: 'smooth' })

      setCurrentIndex(newIndex)
    },
    [matches, currentIndex]
  )

  // Debounced search on query change
  useEffect(() => {
    if (!open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      highlightMatches(query)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, highlightMatches])

  // Cleanup on unmount or close
  useEffect(() => {
    if (!open) {
      clearHighlights()
    }
  }, [open, clearHighlights])

  // Keyboard shortcut: Ctrl+Shift+F to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setOpen(true)
        // Focus input after render
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        navigateToMatch(currentIndex - 1)
      } else {
        navigateToMatch(currentIndex + 1)
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        title="Sök i dokument (Ctrl+Shift+F)"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
          'text-muted-foreground/60 hover:text-muted-foreground hover:bg-primary/5',
          'transition-colors mb-1'
        )}
      >
        <Search className="h-3 w-3" />
        <span>Sök</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 mb-2">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Sök..."
            className={cn(
              'w-full pl-6 pr-2 py-1 rounded-md text-xs',
              'bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-1 focus:ring-primary/30'
            )}
          />
        </div>
        <button
          onClick={() => navigateToMatch(currentIndex - 1)}
          disabled={matches.length === 0}
          title="Föregående (Shift+Enter)"
          className="p-0.5 rounded hover:bg-primary/10 disabled:opacity-30 text-muted-foreground"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => navigateToMatch(currentIndex + 1)}
          disabled={matches.length === 0}
          title="Nästa (Enter)"
          className="p-0.5 rounded hover:bg-primary/10 disabled:opacity-30 text-muted-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleClose}
          title="Stäng (Escape)"
          className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {query.trim() && (
        <span className="text-[10px] text-muted-foreground/60 px-1">
          {matches.length === 0
            ? 'Inga träffar'
            : `${currentIndex + 1}/${matches.length}`}
        </span>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback, type RefObject } from 'react'
import { cn } from '@/lib/utils'

interface TocEntry {
  id: string
  label: string
  children?: TocEntry[]
}

/** Minimum right margin (px) between content edge and viewport/scroll edge */
const MIN_MARGIN = 210

/** Extract id from a heading element */
function getHeadingId(el: Element): string {
  const anchor = el.querySelector('a[name]')
  return (
    anchor?.getAttribute('name') ||
    el.getAttribute('id') ||
    el.getAttribute('name') ||
    ''
  )
}

/**
 * Sticky sidebar navigation for legal documents.
 * Renders as a fixed-position nav in the right margin of the content.
 *
 * - Uses ResizeObserver + scroll listener to calculate position
 * - Automatically hides when insufficient margin or content not visible
 * - Supports nested h3 > h4 hierarchy for large documents
 * - Scroll-based scrollspy: highlights the last heading above the trigger line
 */
export function StickyDocNav({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>
}) {
  const [entries, setEntries] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [left, setLeft] = useState(0)
  const [topBound, setTopBound] = useState(0)
  const rafRef = useRef<number>(0)

  // Flat list of all IDs in DOM order, for scrollspy
  const allIds = useRef<string[]>([])
  useEffect(() => {
    const ids: string[] = []
    for (const entry of entries) {
      ids.push(entry.id)
      if (entry.children) {
        for (const child of entry.children) {
          ids.push(child.id)
        }
      }
    }
    allIds.current = ids
  }, [entries])

  // Position tracking + scrollspy — both run on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Detect scroll context: workspace uses <main overflow-auto>, public uses window
    const mainEl = container.closest('main')
    const isOverflowScroll = mainEl
      ? (() => {
          const style = getComputedStyle(mainEl)
          return (
            style.overflow === 'auto' ||
            style.overflow === 'scroll' ||
            style.overflowY === 'auto' ||
            style.overflowY === 'scroll'
          )
        })()
      : false

    const scrollTarget = isOverflowScroll ? mainEl! : window
    const getScrollRect = () => {
      if (isOverflowScroll && mainEl) {
        return mainEl.getBoundingClientRect()
      }
      // Window scrolling: viewport is the scroll area
      return {
        top: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
        height: window.innerHeight,
      }
    }

    const update = () => {
      const containerRect = container.getBoundingClientRect()
      const scrollRect = getScrollRect()

      // Check right margin
      const rightMargin = scrollRect.right - containerRect.right
      if (rightMargin < MIN_MARGIN) {
        setVisible(false)
        return
      }

      // Only show once the article top has scrolled past the scroll area top
      const articleScrolledIn = containerRect.top < scrollRect.top + 120
      const articleStillVisible = containerRect.bottom > scrollRect.top + 200
      if (!articleScrolledIn || !articleStillVisible) {
        setVisible(false)
        return
      }

      setVisible(true)
      setLeft(containerRect.right + 24)
      setTopBound(Math.max(scrollRect.top + 24, 96))

      // Scrollspy: find the last heading whose top is above the trigger line
      // Trigger line = 20% from top of the scroll area
      const triggerY = scrollRect.top + scrollRect.height * 0.2
      let bestId: string | null = null

      for (const id of allIds.current) {
        const el =
          container.querySelector(`#${CSS.escape(id)}`) ||
          container.querySelector(`[name="${CSS.escape(id)}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= triggerY) {
          bestId = id
        } else {
          break // headings are in DOM order, no need to check further
        }
      }

      if (bestId) setActiveId(bestId)
    }

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }

    update()
    scrollTarget.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver(update)
    ro.observe(mainEl || container)

    return () => {
      scrollTarget.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [containerRef, entries])

  // Scan DOM for navigable structure
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const timer = setTimeout(() => {
      // Strategy 1: Nested h3 + h4 hierarchy
      const h3s = container.querySelectorAll('h3[name], h3[id]')
      const h4s = container.querySelectorAll('h4[name], h4[id]')

      if (h3s.length >= 2) {
        // Build ordered list of all headings with their level
        const allHeadings: {
          level: 3 | 4
          id: string
          label: string
          el: Element
        }[] = []

        h3s.forEach((el) => {
          const id = getHeadingId(el)
          const label = el.textContent?.trim() || ''
          if (id && label) allHeadings.push({ level: 3, id, label, el })
        })

        if (h4s.length >= 1) {
          h4s.forEach((el) => {
            const id = getHeadingId(el)
            const label = el.textContent?.trim() || ''
            if (id && label) allHeadings.push({ level: 4, id, label, el })
          })
        }

        // Sort by DOM order
        allHeadings.sort((a, b) => {
          const pos = a.el.compareDocumentPosition(b.el)
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
          return 0
        })

        // Build tree: h4s nest under the preceding h3
        const tree: TocEntry[] = []
        let currentParent: TocEntry | null = null

        for (const h of allHeadings) {
          if (h.level === 3) {
            currentParent = { id: h.id, label: h.label, children: [] }
            tree.push(currentParent)
          } else if (h.level === 4 && currentParent) {
            currentParent.children!.push({ id: h.id, label: h.label })
          } else {
            // h4 before any h3 — add as top-level
            tree.push({ id: h.id, label: h.label })
          }
        }

        if (tree.length >= 2) {
          setEntries(tree)
          return
        }
      }

      // Strategy 2: Flat h4 headings only
      if (h4s.length >= 2 && h4s.length <= 25) {
        const found: TocEntry[] = []
        h4s.forEach((el) => {
          const id = getHeadingId(el)
          const text = el.textContent?.trim() || ''
          if (id && text) found.push({ id, label: text })
        })
        if (found.length >= 2) {
          setEntries(found)
          return
        }
      }

      // Strategy 3: § anchors for small documents
      const anchors = container.querySelectorAll('a.paragraf')
      if (anchors.length >= 2 && anchors.length <= 25) {
        const found: TocEntry[] = []
        anchors.forEach((el) => {
          const id = el.getAttribute('id') || el.getAttribute('name')
          const text = el.textContent?.trim() || ''
          if (id && text) found.push({ id, label: text })
        })
        setEntries(found)
        return
      }

      setEntries([])
    }, 150)

    return () => clearTimeout(timer)
  }, [containerRef])

  const handleClick = useCallback(
    (id: string) => {
      const container = containerRef.current
      if (!container) return
      const el =
        container.querySelector(`#${CSS.escape(id)}`) ||
        container.querySelector(`[name="${CSS.escape(id)}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [containerRef]
  )

  if (entries.length < 2 || !visible) return null

  // Determine which parent chapter is active (for expanding children)
  const activeParentId = (() => {
    if (!activeId) return null
    for (const entry of entries) {
      if (entry.id === activeId) return entry.id
      if (entry.children?.some((c) => c.id === activeId)) return entry.id
    }
    return null
  })()

  const hasChildren = entries.some((e) => e.children && e.children.length > 0)
  const isParagrafPills = entries[0]?.label.includes('§')

  return (
    <nav
      aria-label="Dokumentnavigering"
      className="flex flex-col gap-0.5 text-xs transition-opacity duration-200"
      style={{
        position: 'fixed',
        top: topBound,
        left,
        width: 180,
        maxHeight: 'calc(100vh - 8rem)',
        overflowY: 'auto',
        zIndex: 10,
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1 px-2">
        Innehåll
      </span>
      {entries.map((entry) => {
        const isActiveParent = activeParentId === entry.id
        const isExpanded = isActiveParent && hasChildren
        const isDirectlyActive = activeId === entry.id

        return (
          <div key={entry.id}>
            <button
              onClick={() => handleClick(entry.id)}
              className={cn(
                'w-full text-left px-2 py-1 rounded-md transition-colors leading-tight',
                'hover:bg-primary/10 hover:text-primary',
                isParagrafPills ? 'font-mono' : 'font-medium',
                isDirectlyActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary rounded-l-none'
                  : isActiveParent
                    ? 'text-primary border-l-2 border-primary rounded-l-none'
                    : 'text-muted-foreground'
              )}
              title={entry.label}
            >
              <span className="line-clamp-2">{entry.label}</span>
            </button>

            {/* Nested children — only show when this chapter is active */}
            {entry.children && entry.children.length > 0 && isExpanded && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {entry.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleClick(child.id)}
                    className={cn(
                      'w-full text-left pl-4 pr-2 py-0.5 rounded-md transition-colors leading-tight text-[11px]',
                      'hover:bg-primary/10 hover:text-primary',
                      activeId === child.id
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground/70'
                    )}
                    title={child.label}
                  >
                    <span className="line-clamp-2">{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

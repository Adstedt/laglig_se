'use client'

import { useEffect, useState, useRef, useCallback, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { DocSearchBar } from './doc-search-bar'

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
  /** Available vertical space within the article container — caps nav height so it
   *  doesn't bleed into the footer when the user scrolls past the document body. */
  const [availableHeight, setAvailableHeight] = useState<number>(0)
  const rafRef = useRef<number>(0)
  const activatedRef = useRef(false)
  const elementMapRef = useRef<Map<string, Element>>(new Map())

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

      // Article completely scrolled out of view — hide and reset latch
      const articleStillVisible = containerRect.bottom > scrollRect.top + 200
      if (!articleStillVisible) {
        setVisible(false)
        activatedRef.current = false
        return
      }

      // Activate once the article is visible in the scroll area.
      // Once activated, stay visible even if user scrolls back to the header.
      const articleScrolledIn =
        containerRect.top < scrollRect.top + scrollRect.height * 0.6
      if (articleScrolledIn) {
        activatedRef.current = true
      }
      if (!activatedRef.current) {
        setVisible(false)
        return
      }

      // Compute the nav's anchor top, then the height available before the article
      // ends (so the nav can never bleed into the footer below the article).
      const nextTopBound = Math.max(containerRect.top, scrollRect.top + 24, 96)
      const heightBudget = containerRect.bottom - nextTopBound
      // Hide entirely when there's no meaningful space left within the article.
      if (heightBudget < 120) {
        setVisible(false)
        return
      }

      setVisible(true)
      setLeft(containerRect.right + 24)
      setTopBound(nextTopBound)
      setAvailableHeight(heightBudget)

      // Scrollspy: find the last heading whose top is above the trigger line
      // Trigger line = 20% from top of the scroll area
      const triggerY = scrollRect.top + scrollRect.height * 0.2
      let bestId: string | null = null

      for (const id of allIds.current) {
        const el =
          elementMapRef.current.get(id) ||
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
      // Dedup helper: generates unique IDs and stores element references
      const elementMap = new Map<string, Element>()
      const seenIds = new Map<string, number>()

      function trackElement(el: Element, rawId: string): string {
        const count = seenIds.get(rawId) || 0
        seenIds.set(rawId, count + 1)
        const uniqueId = count === 0 ? rawId : `${rawId}--${count + 1}`
        elementMap.set(uniqueId, el)
        return uniqueId
      }

      function commitMap() {
        elementMapRef.current = elementMap
      }

      // Strategy 0: Chapter-based hierarchy (h2 chapters with h3 sections nested)
      const chapterSections = container.querySelectorAll('section.kapitel')
      if (chapterSections.length >= 2) {
        const tree: TocEntry[] = []
        chapterSections.forEach((section) => {
          const h2 = section.querySelector('h2')
          const rawSectionId = section.getAttribute('id') || ''
          const label = h2?.textContent?.trim() || ''
          if (!rawSectionId || !label) return

          const sectionId = trackElement(section, rawSectionId)
          const children: TocEntry[] = []
          section.querySelectorAll('h3[id]').forEach((h3) => {
            const rawId = h3.getAttribute('id') || ''
            const text = h3.textContent?.trim() || ''
            if (!rawId || !text) return
            children.push({ id: trackElement(h3, rawId), label: text })
          })

          tree.push({ id: sectionId, label, children })
        })

        if (tree.length >= 2) {
          commitMap()
          setEntries(tree)
          return
        }
      }

      // Strategy 0b: Flat h2 headings (AFS regulations with h2 section headings, no section.kapitel)
      const flatH2s = container.querySelectorAll('h2[id]')
      if (flatH2s.length >= 2) {
        const tree: TocEntry[] = []
        flatH2s.forEach((h2) => {
          const rawId = h2.getAttribute('id') || ''
          const label = h2.textContent?.trim() || ''
          if (rawId && label) tree.push({ id: trackElement(h2, rawId), label })
        })
        if (tree.length >= 2) {
          commitMap()
          setEntries(tree)
          return
        }
      }

      // Strategy 1: Nested h3 + h4 hierarchy (non-chapter documents)
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
          const rawId = getHeadingId(el)
          const label = el.textContent?.trim() || ''
          if (rawId && label)
            allHeadings.push({
              level: 3,
              id: trackElement(el, rawId),
              label,
              el,
            })
        })

        if (h4s.length >= 1) {
          h4s.forEach((el) => {
            const rawId = getHeadingId(el)
            const label = el.textContent?.trim() || ''
            if (rawId && label)
              allHeadings.push({
                level: 4,
                id: trackElement(el, rawId),
                label,
                el,
              })
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
          commitMap()
          setEntries(tree)
          return
        }
      }

      // Strategy 2: Flat h4 headings only
      if (h4s.length >= 2 && h4s.length <= 25) {
        const found: TocEntry[] = []
        h4s.forEach((el) => {
          const rawId = getHeadingId(el)
          const text = el.textContent?.trim() || ''
          if (rawId && text)
            found.push({ id: trackElement(el, rawId), label: text })
        })
        if (found.length >= 2) {
          commitMap()
          setEntries(found)
          return
        }
      }

      // Strategy 3: § anchors for small documents
      const anchors = container.querySelectorAll('a.paragraf')
      if (anchors.length >= 2 && anchors.length <= 25) {
        const found: TocEntry[] = []
        anchors.forEach((el) => {
          const rawId = el.getAttribute('id') || el.getAttribute('name')
          const text = el.textContent?.trim() || ''
          if (rawId && text)
            found.push({ id: trackElement(el, rawId), label: text })
        })
        commitMap()
        setEntries(found)
        return
      }

      commitMap()
      setEntries([])
    }, 150)

    return () => clearTimeout(timer)
  }, [containerRef])

  const handleClick = useCallback((id: string) => {
    const el = elementMapRef.current.get(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Determine which parent chapter is active (for expanding children)
  const activeParentId = (() => {
    if (!activeId) return null
    for (const entry of entries) {
      if (entry.id === activeId) return entry.id
      if (entry.children?.some((c) => c.id === activeId)) return entry.id
    }
    return null
  })()

  /**
   * Auto-scroll the TOC viewport to keep the active item visible as the user
   * scrolls the page. Uses `block: 'nearest'` so we only scroll when the active
   * item is actually outside the nav viewport (most page-scroll ticks no-op).
   * Honors `prefers-reduced-motion` per WCAG 2.3.3.
   */
  useEffect(() => {
    if (!activeId) return
    const navEl = navScrollRef.current
    if (!navEl) return
    const activeBtn = navEl.querySelector<HTMLElement>(
      `button[data-toc-id="${CSS.escape(activeId)}"]`
    )
    if (!activeBtn) return
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    activeBtn.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [activeId])

  const hasChildren = entries.some((e) => e.children && e.children.length > 0)
  const isParagrafPills = entries[0]?.label.includes('§')
  const hasToc = entries.length >= 2

  /**
   * Cap children display per active chapter so chapters with many sub-sections
   * (e.g. "Utlämnande till övriga myndigheter" → 25 agency h3s) don't push
   * subsequent chapters off the visible fold of the sticky nav.
   */
  const CHILDREN_VISIBLE_CAP = 5
  const [chaptersWithAllChildren, setChaptersWithAllChildren] = useState<
    Set<string>
  >(new Set())
  const toggleAllChildren = useCallback((chapterId: string) => {
    setChaptersWithAllChildren((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }, [])

  /**
   * Track scroll-overflow state of the nav so we can render fade gradients
   * at the top/bottom edges as a "more below" affordance. Without this,
   * users can miss content when chapters expand many children.
   */
  const navScrollRef = useRef<HTMLElement | null>(null)
  const [overflowState, setOverflowState] = useState({
    atTop: true,
    atBottom: true,
  })
  const updateOverflowState = useCallback(() => {
    const el = navScrollRef.current
    if (!el) return
    const atTop = el.scrollTop <= 1
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    setOverflowState((prev) =>
      prev.atTop === atTop && prev.atBottom === atBottom
        ? prev
        : { atTop, atBottom }
    )
  }, [])
  useEffect(() => {
    updateOverflowState()
  }, [entries, activeParentId, chaptersWithAllChildren, updateOverflowState])

  return (
    <div
      style={{
        position: 'fixed',
        top: topBound,
        left,
        width: 180,
        // Cap by both the viewport and the article's remaining vertical space
        // so the nav never bleeds into the footer below the article.
        maxHeight: `min(calc(100vh - 8rem), ${availableHeight}px)`,
        zIndex: 10,
        // Fade gradient indicators for scroll overflow
        WebkitMaskImage:
          overflowState.atTop && overflowState.atBottom
            ? undefined
            : `linear-gradient(to bottom, ${overflowState.atTop ? 'black' : 'transparent'} 0%, black 18px, black calc(100% - 18px), ${overflowState.atBottom ? 'black' : 'transparent'} 100%)`,
        maskImage:
          overflowState.atTop && overflowState.atBottom
            ? undefined
            : `linear-gradient(to bottom, ${overflowState.atTop ? 'black' : 'transparent'} 0%, black 18px, black calc(100% - 18px), ${overflowState.atBottom ? 'black' : 'transparent'} 100%)`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 200ms',
      }}
    >
      <nav
        ref={(el) => {
          navScrollRef.current = el
        }}
        onScroll={updateOverflowState}
        aria-label="Dokumentnavigering"
        className="flex flex-col gap-0.5 font-sans text-xs"
        style={{
          maxHeight: `min(calc(100vh - 8rem), ${availableHeight}px)`,
          overflowY: 'auto',
        }}
      >
        <DocSearchBar containerRef={containerRef} />
        {hasToc && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1 px-2">
            Innehåll
          </span>
        )}
        {hasToc &&
          entries.map((entry) => {
            const isActiveParent = activeParentId === entry.id
            const isExpanded = isActiveParent && hasChildren
            const isDirectlyActive = activeId === entry.id
            const allChildren = entry.children ?? []
            const showAll = chaptersWithAllChildren.has(entry.id)
            const visibleChildren =
              showAll || allChildren.length <= CHILDREN_VISIBLE_CAP
                ? allChildren
                : allChildren.slice(0, CHILDREN_VISIBLE_CAP)
            const hiddenChildCount = allChildren.length - visibleChildren.length

            return (
              <div key={entry.id}>
                <button
                  data-toc-id={entry.id}
                  onClick={() => handleClick(entry.id)}
                  aria-current={
                    isDirectlyActive || isActiveParent ? 'true' : undefined
                  }
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
                {allChildren.length > 0 && isExpanded && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {visibleChildren.map((child) => (
                      <button
                        key={child.id}
                        data-toc-id={child.id}
                        onClick={() => handleClick(child.id)}
                        aria-current={
                          activeId === child.id ? 'true' : undefined
                        }
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
                    {hiddenChildCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleAllChildren(entry.id)
                        }}
                        className="w-full text-left pl-4 pr-2 py-0.5 rounded-md text-[11px] text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-colors italic"
                      >
                        + {hiddenChildCount} fler
                      </button>
                    )}
                    {showAll && allChildren.length > CHILDREN_VISIBLE_CAP && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleAllChildren(entry.id)
                        }}
                        className="w-full text-left pl-4 pr-2 py-0.5 rounded-md text-[11px] text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-colors italic"
                      >
                        Visa färre
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </nav>
    </div>
  )
}

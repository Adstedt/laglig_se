'use client'

import { useEffect, useRef } from 'react'

export interface LawContentWithHighlightsProps {
  htmlContent: string
  onFutureAmendmentsFound?: (
    _amendments: { date: string; formattedDate: string }[]
  ) => void
}

export function LawContentWithHighlights({
  htmlContent,
  onFutureAmendmentsFound,
}: LawContentWithHighlightsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureAmendments: { date: string; formattedDate: string }[] = []

    // Style chapter headings - they are in <h3 name="K1">, <h3 name="K2"> etc.
    const chapterHeadings =
      containerRef.current.querySelectorAll('h3[name^="K"]')
    chapterHeadings.forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.cssText = `
        font-size: 1.5rem;
        font-weight: 700;
        margin-top: 2.5rem;
        margin-bottom: 1rem;
        color: var(--foreground, #111827);
      `
    })

    // Find all text nodes containing the SPECIFIC pattern "/Träder i kraft I:YYYY-MM-DD/"
    // This pattern appears inline in paragraph text, NOT in the TOC
    const walker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )

    const nodesToProcess: { node: Text; match: RegExpMatchArray }[] = []

    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      // Only match the EXACT inline pattern with slashes: /Träder i kraft I:YYYY-MM-DD/
      // This excludes the TOC entry which doesn't have slashes
      const match = node.textContent?.match(
        /\/Träder i kraft I:(\d{4})-(\d{2})-(\d{2})\//
      )
      if (match) {
        nodesToProcess.push({ node, match })
      }
    }

    nodesToProcess.forEach(({ node, match }) => {
      const year = parseInt(match[1] ?? '0')
      const month = parseInt(match[2] ?? '0')
      const day = parseInt(match[3] ?? '0')
      const effectiveDate = new Date(year, month - 1, day)

      if (effectiveDate > today) {
        // This is a future amendment - find the parent paragraph to highlight
        const formattedDate = effectiveDate.toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })

        futureAmendments.push({
          date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          formattedDate,
        })

        // Find the paragraph section to highlight
        // Structure: <a class="paragraf" name="K6P17"><b>17 §</b></a> &nbsp;&nbsp; <i>/Träder i kraft I:2028-07-01/</i>
        // The NEW text (that enters into force) follows AFTER the <i> tag until the next <a class="paragraf">

        // We need to highlight the NEW paragraph text, not the old one above it

        const italicEl = node.parentElement // The <i> tag containing "/Träder i kraft.../"
        if (!italicEl) return

        // Find the paragraph anchor BEFORE this italic (that's the § number for the new version)
        let paragrafAnchor: Element | null = null
        let sibling: Element | null = italicEl.previousElementSibling

        // Walk backwards to find <a class="paragraf">
        while (sibling) {
          if (sibling.matches('a.paragraf')) {
            paragrafAnchor = sibling
            break
          }
          sibling = sibling.previousElementSibling
        }

        if (paragrafAnchor) {
          // Create wrapper for the NEW paragraph section with inline styles
          const wrapper = document.createElement('div')
          wrapper.className = 'future-amendment-highlight'
          wrapper.style.cssText = `
            position: relative;
            background: linear-gradient(to right, rgba(251, 191, 36, 0.15), transparent);
            border-left: 4px solid rgb(251, 191, 36);
            padding: 1rem;
            padding-left: 1.5rem;
            margin: 1rem 0;
            border-radius: 0 0.5rem 0.5rem 0;
          `

          // Add badge at top of wrapper with inline styles
          const badge = document.createElement('div')
          badge.style.cssText = 'margin-bottom: 0.75rem;'
          badge.innerHTML = `
            <span style="
              display: inline-flex;
              align-items: center;
              gap: 0.375rem;
              padding: 0.25rem 0.75rem;
              background-color: rgb(254, 243, 199);
              color: rgb(146, 64, 14);
              border-radius: 9999px;
              font-size: 0.8125rem;
              font-weight: 600;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Träder i kraft ${formattedDate}
            </span>
          `
          wrapper.appendChild(badge)

          // Insert wrapper BEFORE the paragraph anchor
          paragrafAnchor.parentNode?.insertBefore(wrapper, paragrafAnchor)

          // Move the paragraph anchor and all following content into wrapper
          // until we hit the NEXT paragraph anchor (which starts a different §)
          let nextEl: Node | null = wrapper.nextSibling
          while (nextEl) {
            const next = nextEl.nextSibling

            // Check if this is the START of a different paragraph (next §)
            if (nextEl instanceof Element) {
              // If it's a paragraph anchor with a DIFFERENT name, stop
              if (nextEl.matches('a.paragraf')) {
                const currentName = paragrafAnchor.getAttribute('name')
                const nextName = nextEl.getAttribute('name')
                // If it's a different paragraph (e.g., K6P18 vs K6P17), stop
                if (nextName && currentName && nextName !== currentName) {
                  break
                }
              }
              // If it contains a different paragraph anchor, stop
              const innerAnchor = nextEl.querySelector('a.paragraf')
              if (innerAnchor) {
                const currentName = paragrafAnchor.getAttribute('name')
                const innerName = innerAnchor.getAttribute('name')
                if (innerName && currentName && innerName !== currentName) {
                  break
                }
              }
            }

            wrapper.appendChild(nextEl)
            nextEl = next
          }
        }
      }
    })

    // Report found amendments to parent
    if (onFutureAmendmentsFound && futureAmendments.length > 0) {
      onFutureAmendmentsFound(futureAmendments)
    }
  }, [htmlContent, onFutureAmendmentsFound])

  return (
    <>
      <style jsx global>{`
        .future-amendment-highlight {
          position: relative;
          background: linear-gradient(
            to right,
            rgba(251, 191, 36, 0.1),
            transparent
          );
          border-left: 3px solid rgb(251, 191, 36);
          padding-left: 1rem;
          margin-left: -1rem;
          border-radius: 0 0.5rem 0.5rem 0;
        }

        .dark .future-amendment-highlight {
          background: linear-gradient(
            to right,
            rgba(251, 191, 36, 0.05),
            transparent
          );
          border-left-color: rgb(217, 119, 6);
        }

        .future-amendment-indicator {
          margin-bottom: 0.5rem;
        }

        .future-amendment-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          background-color: rgb(254, 243, 199);
          color: rgb(146, 64, 14);
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .dark .future-amendment-badge {
          background-color: rgba(146, 64, 14, 0.3);
          color: rgb(252, 211, 77);
        }

        .future-amendment-badge svg {
          flex-shrink: 0;
        }
      `}</style>
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </>
  )
}

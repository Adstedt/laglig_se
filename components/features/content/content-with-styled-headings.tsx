'use client'

import { useEffect, useRef } from 'react'

interface ContentWithStyledHeadingsProps {
  htmlContent: string
  className?: string
}

export function ContentWithStyledHeadings({
  htmlContent,
  className,
}: ContentWithStyledHeadingsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Style h2 and h3 headings to be more prominent
    const headings = containerRef.current.querySelectorAll('h2, h3')
    headings.forEach((el) => {
      const htmlEl = el as HTMLElement
      const isH2 = el.tagName === 'H2'
      htmlEl.style.cssText = `
        font-size: ${isH2 ? '1.5rem' : '1.25rem'};
        font-weight: 700;
        margin-top: ${isH2 ? '2.5rem' : '2rem'};
        margin-bottom: 1rem;
        color: var(--foreground, #111827);
      `
    })
  }, [htmlContent])

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}

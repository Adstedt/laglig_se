'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StickyDocNav } from '@/components/features/paragraf-toc'

interface LegalDocumentCardProps {
  htmlContent: string
  className?: string
}

/**
 * Card wrapper for legal document HTML with sticky sidebar navigation.
 * Use this when rendering html_content with dangerouslySetInnerHTML in server components.
 */
export function LegalDocumentCard({
  htmlContent,
  className,
}: LegalDocumentCardProps) {
  const articleRef = useRef<HTMLDivElement>(null)

  // Wrap wide tables in a horizontally-scrollable container
  useEffect(() => {
    if (!articleRef.current) return
    const tables = articleRef.current.querySelectorAll('table')
    tables.forEach((table) => {
      if (table.parentElement?.classList.contains('table-scroll-wrapper'))
        return
      const wrapper = document.createElement('div')
      wrapper.className = 'table-scroll-wrapper'
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(table)
    })
  }, [htmlContent])

  return (
    <>
      <Card className={className}>
        <CardContent className="p-0">
          <div
            ref={articleRef}
            className="legal-document p-6"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </CardContent>
      </Card>

      {/* Fixed-position sidebar nav — self-positioning, auto-hides when no room */}
      <StickyDocNav containerRef={articleRef} />
    </>
  )
}

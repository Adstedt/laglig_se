'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { StickyDocNav } from '@/components/features/paragraf-toc'
import { rewriteLinksForWorkspace } from '@/lib/linkify/rewrite-links'

interface DocumentContentProps {
  /** Raw HTML content to render. Ignored when `children` is provided. */
  htmlContent?: string | null | undefined
  /** Plain-text fallback when `htmlContent` is empty. */
  fallbackText?: string | null | undefined
  /** When true, rewrite /lagar/* and /foreskrifter/* links to /browse/* */
  isWorkspace?: boolean | undefined
  /** Custom inner renderer — e.g. LawContentWithHighlights. Overrides htmlContent rendering. */
  children?: ReactNode | undefined
  className?: string | undefined
}

/**
 * Unified renderer for legal document HTML with:
 *  - `.legal-document` container (globals.css rules)
 *  - Automatic table wrapping for horizontal scroll
 *  - Workspace link rewriting via `isWorkspace`
 *  - Sticky sidebar navigation (TOC + in-document search)
 *
 * Replaces LegalDocumentCard, HtmlContentRenderer, and ContentWithStyledHeadings.
 * For law pages that need future-amendment highlights, pass
 * <LawContentWithHighlights/> as children.
 */
export function DocumentContent({
  htmlContent,
  fallbackText,
  isWorkspace = false,
  children,
  className,
}: DocumentContentProps) {
  const articleRef = useRef<HTMLElement>(null)

  const processedHtml = useMemo(() => {
    if (!htmlContent) return null
    return isWorkspace ? rewriteLinksForWorkspace(htmlContent) : htmlContent
  }, [htmlContent, isWorkspace])

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
  }, [processedHtml, children])

  // When rendering raw HTML, use dangerouslySetInnerHTML (no children allowed)
  if (!children && processedHtml) {
    return (
      <>
        <article
          ref={articleRef}
          className={cn('legal-document', className)}
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
        <StickyDocNav containerRef={articleRef} />
      </>
    )
  }

  // Otherwise render children, fallback text, or empty-state
  return (
    <>
      <article ref={articleRef} className={cn('legal-document', className)}>
        {children ? (
          children
        ) : fallbackText ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {fallbackText}
          </pre>
        ) : (
          <p className="italic text-muted-foreground py-8 text-center">
            Ingen text tillgänglig.
          </p>
        )}
      </article>
      <StickyDocNav containerRef={articleRef} />
    </>
  )
}

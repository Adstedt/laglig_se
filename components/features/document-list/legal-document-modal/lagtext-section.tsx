'use client'

/**
 * Story 6.3: Lagtext Section
 * Collapsible legal text with expand/collapse and quick links
 * Reuses the same rendering components as the law browse pages
 */

import { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LawContentWrapper } from '@/app/(public)/lagar/[id]/law-content-wrapper'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface LagtextSectionProps {
  documentId: string
  htmlContent: string | null
  fullText: string | null
  slug: string
  sourceUrl: string | null
  maxCollapsedHeight?: number
  maxExpandedHeight?: number
  isLoading?: boolean
}

/**
 * Clean HTML from Riksdagen - removes metadata block before the actual law content
 * Same logic as used in the law browse pages
 */
function cleanLawHtml(html: string): string {
  let cleaned = html
  // Remove leading h2 title (redundant with our header)
  cleaned = cleaned.replace(/^<h2>[^<]+<\/h2>\s*/i, '')
  // Find the <hr> that separates metadata from content
  const hrIndex = cleaned.indexOf('<hr')
  if (hrIndex !== -1) {
    const hrEndIndex = cleaned.indexOf('>', hrIndex)
    if (hrEndIndex !== -1) {
      // Skip everything before and including the <hr>
      cleaned = cleaned.substring(hrEndIndex + 1)
    }
  }
  // Clean up leading whitespace and br tags
  cleaned = cleaned.replace(/^\s*<br\s*\/?>\s*/gi, '')
  // Remove any remaining hr tags
  cleaned = cleaned.replace(/<hr\s*\/?>/gi, '')
  // Clean up trailing punctuation issues
  cleaned = cleaned.replace(/<\/i>\s*\.\s*(?=<)/gi, '</i>')
  cleaned = cleaned.replace(/<p>\s*\.\s*<\/p>/gi, '')
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '')
  cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>)+\s*<\/p>/gi, '')
  return cleaned.trim()
}

export function LagtextSection({
  documentId: _documentId,
  htmlContent,
  fullText,
  slug,
  sourceUrl,
  maxCollapsedHeight = 300,
  maxExpandedHeight = 600,
  isLoading,
}: LagtextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Toggle expand/collapse - scroll to top when collapsing
  const handleToggle = useCallback(() => {
    if (isExpanded && contentRef.current) {
      // Scroll to top before collapsing
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      // Small delay to let scroll complete before collapsing
      setTimeout(() => setIsExpanded(false), 150)
    } else {
      setIsExpanded(true)
    }
  }, [isExpanded])

  // Check if source URL is a PDF
  const hasPdf = sourceUrl?.toLowerCase().endsWith('.pdf')

  // Clean the HTML content to remove metadata block
  const cleanedHtmlContent = useMemo(() => {
    if (!htmlContent) return null
    return cleanLawHtml(htmlContent)
  }, [htmlContent])

  const hasContent = cleanedHtmlContent || fullText

  // Show skeleton while loading content
  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Lagtext</h3>
        <div className="space-y-3 py-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
        </div>
        {/* Quick links row */}
        <QuickLinksRow slug={slug} sourceUrl={sourceUrl} hasPdf={hasPdf} />
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Lagtext</h3>
        <div className="text-muted-foreground italic py-4 text-sm">
          Ingen lagtext tillgänglig
        </div>
        {/* Quick links row */}
        <QuickLinksRow slug={slug} sourceUrl={sourceUrl} hasPdf={hasPdf} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Lagtext</h3>

      <div className="relative">
        {/* Content container using the same component as law browse pages */}
        <div
          ref={contentRef}
          className={cn(
            'transition-all duration-300',
            isExpanded ? 'overflow-y-auto' : 'overflow-hidden'
          )}
          style={{
            maxHeight: isExpanded ? maxExpandedHeight : maxCollapsedHeight,
          }}
        >
          <article className="legal-document-modal">
            <div className="legal-document">
              <LawContentWrapper
                htmlContent={cleanedHtmlContent ?? ''}
                fallbackText={fullText}
              />
            </div>
          </article>
        </div>

        {/* Gradient fade when collapsed */}
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/Collapse button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="w-full justify-center"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-4 w-4 mr-1" />
            Visa mindre
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-1" />
            Visa mer
          </>
        )}
      </Button>

      {/* Quick links row */}
      <QuickLinksRow slug={slug} sourceUrl={sourceUrl} hasPdf={hasPdf} />
    </div>
  )
}

function QuickLinksRow({
  slug,
  sourceUrl,
  hasPdf,
}: {
  slug: string
  sourceUrl: string | null
  hasPdf: boolean | undefined
}) {
  return (
    <div className="flex items-center gap-4 pt-2 border-t">
      <Link
        href={`/browse/lagar/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Visa på egen sida
      </Link>

      {hasPdf && sourceUrl && (
        <Link
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <FileDown className="h-3.5 w-3.5" />
          Ladda ner PDF
        </Link>
      )}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { CitationDetailData } from '@/lib/ai/chat-detail-context'

interface CitationDetailProps {
  data: CitationDetailData
}

/**
 * Strip markdown link syntax from legal text, keeping only the display text.
 * Converts `Lag (2002:585)(/lagar/andringar/... "title")` → `Lag (2002:585)`
 * and standard `[text](url)` → `text`
 */
function stripMarkdownLinks(text: string): string {
  return (
    text
      // Pattern from legal docs: `Text)(url "title")` — the markdown content uses
      // a non-standard format where the link text ends with `)` before `(url`
      .replace(/\)\(\/[^\s)]+(?:\s+"[^"]*")?\)/g, ')')
      // Standard markdown links: [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  )
}

export function CitationDetail({ data }: CitationDetailProps) {
  const href = data.slug
    ? `/lagar/${data.slug}${data.anchorId ? `#${data.anchorId}` : ''}`
    : null

  const cleanSnippet = useMemo(
    () => (data.snippet ? stripMarkdownLinks(data.snippet) : null),
    [data.snippet]
  )

  return (
    <div className="space-y-4">
      {/* Section text — the primary content of the detail view */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Källa
        </p>
        {cleanSnippet ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {cleanSnippet}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Fullständig lagtext visas i lagläsaren.
            </p>
          </div>
        )}
      </div>

      {/* Link to document reader */}
      {href && (
        <Link
          href={href}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Visa i lagläsaren
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

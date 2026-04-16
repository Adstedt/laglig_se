'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const isWebSource = !!data.url
  const href =
    !isWebSource && data.slug
      ? `/lagar/${data.slug}${data.anchorId ? `#${data.anchorId}` : ''}`
      : null

  const webDomain =
    isWebSource && data.url
      ? new URL(data.url).hostname.replace(/^www\./, '')
      : null

  const cleanSnippet = useMemo(
    () => (data.snippet ? stripMarkdownLinks(data.snippet) : null),
    [data.snippet]
  )

  // Web source detail view
  if (isWebSource) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Webbkälla
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            {data.title && (
              <p className="text-sm font-medium leading-relaxed">
                {data.title}
              </p>
            )}
            {webDomain && (
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                {webDomain}
              </p>
            )}
          </div>
        </div>

        {data.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={data.url} target="_blank" rel="noopener noreferrer">
              Besök källa
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        )}
      </div>
    )
  }

  // DB source detail view (unchanged)
  return (
    <div className="space-y-4">
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

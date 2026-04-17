'use client'

import { useMemo } from 'react'
import { Globe, ExternalLink } from 'lucide-react'

interface WebSearchResult {
  url: string
  title: string | null
  pageAge: string | null
}

interface WebSearchDetailProps {
  data: unknown
}

/**
 * Clean renderer for web_search tool results.
 * Shows a list of search results with title, domain, and link.
 * Filters out encrypted content and technical fields.
 */
export function WebSearchDetail({ data }: WebSearchDetailProps) {
  const results = useMemo(() => {
    // Unwrap ToolResponse shape: { data: T, _meta: {...} }
    const payload =
      data && typeof data === 'object' && 'data' in data
        ? (data as Record<string, unknown>).data
        : data

    if (!Array.isArray(payload)) return []

    return (payload as Array<Record<string, unknown>>)
      .filter((item) => item.url && typeof item.url === 'string')
      .map(
        (item): WebSearchResult => ({
          url: item.url as string,
          title: (item.title as string | null) ?? null,
          pageAge: (item.pageAge as string | null) ?? null,
        })
      )
  }, [data])

  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">Inga sökresultat.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {results.length} sökresultat
      </p>
      <div className="space-y-1">
        {results.map((result, i) => {
          let domain: string
          try {
            domain = new URL(result.url).hostname.replace(/^www\./, '')
          } catch {
            domain = result.url
          }

          return (
            <a
              key={i}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/40 group"
            >
              <Globe className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="min-w-0 flex-1">
                {result.title && (
                  <p className="text-sm font-medium leading-snug truncate">
                    {result.title}
                  </p>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {domain}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

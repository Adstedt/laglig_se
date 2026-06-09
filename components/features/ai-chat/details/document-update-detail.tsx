'use client'

/**
 * Story 17.11: read-only before/after preview of a proposed section edit,
 * opened in the chat detail panel via the UPDATE_DOCUMENT card's "Visa mer".
 *
 * Reads both snapshots from `params` (captured at propose time by the tool) —
 * no document re-fetch, no editing. Renders each section body via the shared
 * `tiptapDocToHtml` walker (server-friendly + browser-safe — pure JS).
 * Borrows 14.24's `document-draft-detail` chrome.
 */

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { tiptapDocToHtml } from '@/lib/documents/tiptap-to-html'
import type { DocumentUpdateDetailData } from '@/lib/ai/chat-detail-context'

function renderBody(nodes: unknown[] | undefined): string {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '<p class="text-muted-foreground italic">(tom)</p>'
  }
  try {
    return tiptapDocToHtml({ type: 'doc', content: nodes })
  } catch {
    return '<p class="text-muted-foreground">Förhandsvisningen kunde inte renderas.</p>'
  }
}

export function DocumentUpdateDetail({
  data,
}: {
  data: DocumentUpdateDetailData
}) {
  const oldHtml = useMemo(
    () => renderBody(data.oldSectionContentJson),
    [data.oldSectionContentJson]
  )
  const newHtml = useMemo(
    () => renderBody(data.newSectionContentJson),
    [data.newSectionContentJson]
  )

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Badge tone="neutral" variant="outline" className="text-[10px]">
          Sektion: {data.sectionHeading}
        </Badge>
        <p className="text-xs text-muted-foreground">{data.documentTitle}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Nuvarande innehåll
        </h3>
        <div
          className="prose prose-sm max-w-none rounded-md border border-border/60 bg-muted/30 px-3 py-2 opacity-80 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: oldHtml }}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Föreslaget nytt innehåll
        </h3>
        <div
          className="prose prose-sm max-w-none rounded-md border border-emerald-400/40 bg-emerald-50/40 px-3 py-2 dark:prose-invert dark:bg-emerald-950/30"
          dangerouslySetInnerHTML={{ __html: newHtml }}
        />
      </section>
    </div>
  )
}

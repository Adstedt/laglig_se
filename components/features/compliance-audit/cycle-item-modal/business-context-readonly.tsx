'use client'

/**
 * Story 21.16 follow-up — read-only "Hur påverkar detta oss?" renderer for
 * the cycle-item modal's left panel.
 *
 * Surfaces the live `businessContext` field from the source LawListItem as
 * audit context. Edits are intentionally NOT handled here — they go through
 * the existing law-list-item modal (`legal-document-modal`) on /laglistor
 * via a "Redigera i laglistan" deep-link that opens in a new tab so the
 * auditor's kontroll modal state is preserved.
 *
 * Reuses `RichTextDisplay` from `@/components/ui/rich-text-editor` for
 * consistent rendering with the source surface.
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { RichTextDisplay } from '@/components/ui/rich-text-editor'

interface BusinessContextReadOnlyProps {
  content: string | null
  lawListItemId: string
}

export function BusinessContextReadOnly({
  content,
  lawListItemId,
}: BusinessContextReadOnlyProps) {
  // Null OR empty-string → empty state. DB column is @db.Text nullable; users
  // can save-then-clear which persists as empty string. Treat both the same.
  const hasContent = content !== null && content.trim().length > 0
  const editHref = `/laglistor?document=${encodeURIComponent(lawListItemId)}`

  if (!hasContent) {
    return (
      <div
        className="rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center"
        data-testid="business-context-empty-state"
      >
        <p className="text-sm text-muted-foreground">Ingen beskrivning ännu.</p>
        <Link
          href={editHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="business-context-edit-link"
        >
          Lägg till i laglistan
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  return (
    <div
      className="rounded-md border border-border/60 bg-card px-4 py-3"
      data-testid="business-context-content"
    >
      <RichTextDisplay content={content as string} />
      <div className="mt-3 flex justify-end">
        <Link
          href={editHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
          data-testid="business-context-edit-link"
        >
          Redigera i laglistan
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

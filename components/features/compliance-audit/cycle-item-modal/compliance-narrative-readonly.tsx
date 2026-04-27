'use client'

/**
 * Story 21.22 — read-only "Hur efterlever vi kraven?" renderer for the
 * cycle-item modal's left panel.
 *
 * Surfaces the live `complianceNarrative` field from the source LawListItem.
 * Edits are intentionally NOT handled here — they go through the law-list-item
 * modal on /laglistor via a "Redigera i laglistan" deep-link that opens in a
 * new tab so the auditor's kontroll modal state is preserved. Mirrors the
 * pattern in `business-context-readonly.tsx`.
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { RichTextDisplay } from '@/components/ui/rich-text-editor'

interface ComplianceNarrativeReadOnlyProps {
  content: string | null
  lawListItemId: string
}

export function ComplianceNarrativeReadOnly({
  content,
  lawListItemId,
}: ComplianceNarrativeReadOnlyProps) {
  const hasContent =
    content !== null && content !== undefined && content.trim().length > 0
  const editHref = `/laglistor?document=${encodeURIComponent(lawListItemId)}`

  if (!hasContent) {
    return (
      <div
        className="rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center"
        data-testid="compliance-narrative-empty-state"
      >
        <p className="text-sm text-muted-foreground">
          Ingen efterlevnadsbeskrivning ännu.
        </p>
        <Link
          href={editHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="compliance-narrative-edit-link"
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
      data-testid="compliance-narrative-content"
    >
      <RichTextDisplay content={content as string} />
      <div className="mt-3 flex justify-end">
        <Link
          href={editHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
          data-testid="compliance-narrative-edit-link"
        >
          Redigera i laglistan
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

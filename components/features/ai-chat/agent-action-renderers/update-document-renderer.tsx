'use client'

/**
 * Story 17.11: UPDATE_DOCUMENT approval renderer.
 *
 * Built on the 14.23 ActionRendererFrame (no hand-rolled chrome). Primary
 * template: 14.28's `update-requirement-renderer.tsx` — overwrite-an-
 * existing-entity-field-via-a-diff-card. Borrows 14.24's `chat-detail-panel`
 * pattern for the read-only before/after preview (canvas seam, 14.24 AC 11a).
 *
 * Diff display reads BOTH snapshots from `params` (`oldSectionContentJson` +
 * `newSectionContentJson`, captured at propose time by the tool) — no re-fetch.
 *
 * CP-001 (AC 6 formatting guardrail): copy NEVER exposes raw identifiers —
 * no `documentId`, no `pendingActionId`, no `section_heading` rendered as
 * a code-style or quoted identifier. Document title + heading text are used
 * as natural Swedish language.
 */

import { useMemo, useState } from 'react'
import { Check, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { computeDiff } from '@/lib/utils/document-diff'
import {
  tiptapParagraphsToText,
  textToTiptapParagraphs,
  isParagraphsOnly,
} from '@/lib/utils/tiptap-text'
import { cn } from '@/lib/utils'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

interface UpdateDocumentParams {
  documentId?: string
  documentTitle?: string
  sectionHeading?: string
  oldSectionContentJson?: unknown[]
  newSectionContentJson?: unknown[]
  // Optional rename — when present, the card shows the proposed new title.
  newTitle?: string
  changeSummary?: string
  entity_version?: string
  // Story 17.11c AC 6: when true, the renderer prepends a "Skapar nytt utkast
  // v{N+1} av {documentTitle}" header line above the diff card body to make
  // the auto-branch intent explicit before the user approves.
  creates_draft?: boolean
  newVersionNumber?: number
}

export function UpdateDocumentRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as UpdateDocumentParams

  // CP-001 (AC 6): the document's natural-language title — never the id —
  // appears in the visible card copy. The tool stamps `documentTitle` into
  // params at propose time (lib/agent/tools/update-document.ts); the generic
  // fallback only triggers on a legacy pre-fix proposal row.
  const documentTitle = params.documentTitle ?? 'styrdokumentet'

  // A proposal may be a section edit, a rename (newTitle), or both.
  const hasSectionEdit =
    typeof params.sectionHeading === 'string' &&
    params.sectionHeading.length > 0
  const sectionHeading = params.sectionHeading ?? '(okänt avsnitt)'
  const newTitle =
    typeof params.newTitle === 'string' && params.newTitle.trim().length > 0
      ? params.newTitle.trim()
      : undefined

  const oldNodes = Array.isArray(params.oldSectionContentJson)
    ? params.oldSectionContentJson
    : []
  const newNodes = Array.isArray(params.newSectionContentJson)
    ? params.newSectionContentJson
    : []

  // Story 17.20: inline plaintext editing of a *simple* (paragraphs-only)
  // proposed body. Rich bodies (lists/tables/headings) stay read-only — never
  // silently flatten them (AC 3).
  const canEditBody = hasSectionEdit && isParagraphsOnly(newNodes)
  const hasRename = newTitle !== undefined

  // Seed local edit state ONCE from the proposal (mirrors TaskApprovalRenderer);
  // later param refetches don't clobber in-flight keystrokes.
  const [bodyDraft, setBodyDraft] = useState(() =>
    tiptapParagraphsToText(newNodes)
  )
  const [titleDraft, setTitleDraft] = useState(newTitle ?? '')

  const bodyEmpty = canEditBody && bodyDraft.trim().length === 0

  // AC 2: `updatePendingActionParams` REPLACES params wholesale — send the
  // complete snapshot, overwriting only the edited fields. AC 5b: never persist
  // an empty body (the approve dispatch guards only on `!== undefined`, so a
  // persisted `[]` would survive into single- or batch-approve).
  const fullParams = {
    ...params,
    ...(canEditBody
      ? { newSectionContentJson: textToTiptapParagraphs(bodyDraft) }
      : {}),
    ...(hasRename ? { newTitle: titleDraft.trim() } : {}),
  }
  useDebouncedParamsChange(
    onParamsChange,
    fullParams,
    action.status === 'PENDING' && !bodyEmpty
  )

  // Word-level diff of the full section text (no truncation — long sections
  // scroll inside the diff box). Removed words show red + struck, added green.
  // Both sides use the paragraph-preserving flattener so whitespace matches; the
  // new side is driven off LOCAL state so the preview tracks keystrokes (the
  // persisted value lags by the 500ms debounce + refetch — AC 2 / Task 2.2).
  const oldText = tiptapParagraphsToText(oldNodes)
  const newText = canEditBody ? bodyDraft : tiptapParagraphsToText(newNodes)
  const diffSegments = useMemo(
    () => computeDiff(oldText, newText),
    [oldText, newText]
  )

  const summary =
    hasSectionEdit && newTitle
      ? `Uppdatera avsnittet "${sectionHeading}" och byt namn på ${documentTitle}`
      : newTitle
        ? `Byt namn på ${documentTitle} till "${newTitle}"`
        : `Uppdatera avsnittet "${sectionHeading}" i ${documentTitle}`

  const resultRef = (action.result_ref ?? {}) as {
    documentId?: string
    versionNumber?: number
  }

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — dokumentet uppdaterat
      </div>
      <p className="text-sm leading-snug text-muted-foreground">{summary}</p>
      {resultRef.documentId && (
        <a
          href={`/workspace/styrdokument/${resultRef.documentId}/edit`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Öppna dokument
          {typeof resultRef.versionNumber === 'number' && (
            <span className="ml-1 text-muted-foreground/60">
              · v{resultRef.versionNumber}
            </span>
          )}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Uppdatera dokument"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={!bodyEmpty}
    >
      <div className="space-y-3">
        {/* Story 17.11c AC 9: auto-branch header. PENDING state only —
            APPROVED state shows the actual saved version via resultRef. */}
        {params.creates_draft === true &&
          action.status === 'PENDING' &&
          params.newVersionNumber != null && (
            <p className="text-xs text-muted-foreground">
              Skapar nytt utkast v{params.newVersionNumber} av {documentTitle}
            </p>
          )}

        {/* Story 17.20: the rename target is now an editable input (a plain
            string is always safe to edit). The struck old title gives context. */}
        {hasRename && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Nytt namn</span>
            <p className="text-[12px] leading-snug text-muted-foreground line-through">
              {documentTitle}
            </p>
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              disabled={isSubmitting}
              aria-label="Nytt namn"
              // See textarea note: keep the focus ring inset so the
              // overflow-hidden Collapsible body doesn't clip it.
              className="focus-visible:ring-inset focus-visible:ring-offset-0"
            />
          </div>
        )}

        {hasSectionEdit && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Avsnitt</span>
            <Badge tone="neutral" variant="outline" className="text-[10px]">
              {sectionHeading}
            </Badge>
          </div>
        )}

        {params.changeSummary && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Sammanfattning</span>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {params.changeSummary}
            </p>
          </div>
        )}

        {hasSectionEdit && (
          <div className="space-y-1.5">
            <span className={`${LABEL_CLS} block`}>Ändring</span>

            {/* Story 17.20: simple (paragraphs-only) bodies are editable inline;
                rich bodies stay read-only with a hint (AC 3). */}
            {canEditBody ? (
              <>
                <Textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  disabled={isSubmitting}
                  aria-label="Föreslagen text"
                  // ring-inset + offset-0: the focus ring draws INSIDE the box so
                  // it isn't clipped by the "Justera" CollapsibleContent's
                  // overflow-hidden (needed for its height animation).
                  className="min-h-[88px] max-h-[260px] resize-y text-[13px] leading-relaxed focus-visible:ring-inset focus-visible:ring-offset-0"
                  placeholder="Föreslagen text…"
                />
                {bodyEmpty && (
                  <p className="text-[12px] text-amber-600 dark:text-amber-400">
                    Texten kan inte vara tom — fyll i ett innehåll för att
                    godkänna.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12px] leading-snug text-muted-foreground">
                Den föreslagna ändringen innehåller listor eller tabeller och
                kan inte finjusteras här. Be agenten finjustera, eller öppna
                dokumentet i editorn.
              </p>
            )}

            <span className={`${LABEL_CLS} block pt-1`}>Förhandsvisning</span>
            <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2.5 text-[13px] leading-snug">
              {diffSegments.length > 0 ? (
                diffSegments.map((seg, i) => (
                  <span
                    key={i}
                    className={cn(
                      !seg.added && !seg.removed && 'text-foreground',
                      seg.added &&
                        'rounded-[3px] bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
                      seg.removed &&
                        'rounded-[3px] bg-rose-100 text-rose-900 line-through dark:bg-rose-900/30 dark:text-rose-300'
                    )}
                  >
                    {seg.value}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">(tom)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </ActionRendererFrame>
  )
}

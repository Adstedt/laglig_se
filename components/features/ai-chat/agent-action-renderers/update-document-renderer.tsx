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

import { Check, ArrowUpRight, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useChatDetailSafe } from '@/lib/ai/chat-detail-context'
import type { AgentActionRendererProps } from './task-approval-renderer'
import { ActionRendererFrame, LABEL_CLS } from './renderer-frame'

interface TiptapNode {
  type?: string
  text?: string
  content?: TiptapNode[]
}

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

function plainText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ''
  const walk = (n: unknown): string => {
    if (!n || typeof n !== 'object') return ''
    const node = n as TiptapNode
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.content)) return node.content.map(walk).join(' ')
    return ''
  }
  return nodes.map(walk).join(' ').replace(/\s+/g, ' ').trim()
}

export function UpdateDocumentRenderer({
  action,
  onApprove,
  onReject,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as UpdateDocumentParams
  const chatDetail = useChatDetailSafe()

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
  const oldExcerpt = plainText(oldNodes).slice(0, 200)
  const newExcerpt = plainText(newNodes).slice(0, 200)

  const summary =
    hasSectionEdit && newTitle
      ? `Uppdatera avsnittet "${sectionHeading}" och byt namn på ${documentTitle}`
      : newTitle
        ? `Byt namn på ${documentTitle} till "${newTitle}"`
        : `Uppdatera avsnittet "${sectionHeading}" i ${documentTitle}`

  const openCanvas = () => {
    chatDetail?.openDetail({
      type: 'document-update',
      id: action.id,
      data: {
        pendingActionId: action.id,
        documentTitle,
        sectionHeading,
        oldSectionContentJson: oldNodes,
        newSectionContentJson: newNodes,
      },
    })
  }

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

  const secondaryAction = chatDetail ? (
    <button
      type="button"
      onClick={openCanvas}
      disabled={isSubmitting}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      <Eye className="h-3 w-3" />
      Visa mer
    </button>
  ) : undefined

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
      {...(secondaryAction !== undefined && { secondaryAction })}
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

        {newTitle && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Nytt namn</span>
            <p className="text-[13px] leading-snug text-foreground">
              <span className="text-muted-foreground line-through">
                {documentTitle}
              </span>{' '}
              → {newTitle}
            </p>
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
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Nuvarande</span>
            <p className="line-clamp-3 text-[13px] leading-snug text-muted-foreground line-through">
              {oldExcerpt || '(tom)'}
            </p>
          </div>
        )}

        {hasSectionEdit && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Föreslaget</span>
            <p className="line-clamp-3 text-[13px] leading-snug text-foreground">
              {newExcerpt || '(tom)'}
            </p>
          </div>
        )}
      </div>
    </ActionRendererFrame>
  )
}

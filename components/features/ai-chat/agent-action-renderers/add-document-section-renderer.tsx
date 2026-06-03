'use client'

/**
 * Story 17.11b: ADD_DOCUMENT_SECTION approval renderer.
 *
 * Built on the 14.23 ActionRendererFrame (no hand-rolled chrome). Primary
 * template: 17.11's `update-document-renderer.tsx` — the diff card degenerates
 * cleanly for an insert: "Nuvarande" shows `(tom)` for an empty old snapshot,
 * "Föreslaget" carries the new section body excerpt.
 *
 * Detail panel: reuses the existing `'document-update'` ChatDetailItem variant
 * (passing `oldSectionContentJson: []`); the existing `document-update-detail.tsx`
 * walker renders the `(tom)` placeholder for the empty array — no new detail
 * component or sidebar switch change needed.
 *
 * CP-001 (AC 6 formatting guardrail): copy NEVER exposes raw identifiers —
 * no `documentId`, no `pendingActionId`, no `new_section_heading` rendered as
 * a code-style or quoted identifier (the heading TEXT IS the natural Swedish
 * subject of the change).
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

type InsertPosition =
  | { at: 'start' }
  | { at: 'end' }
  | { at: 'after'; heading: string }
  | { at: 'before'; heading: string }

interface AddDocumentSectionParams {
  documentId?: string
  documentTitle?: string
  newSectionHeading?: string
  newSectionLevel?: 1 | 2 | 3 | 4 | 5 | 6
  newSectionContentJson?: unknown[]
  position?: InsertPosition
  changeSummary?: string
  entity_version?: string
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

function positionLabelSv(position: InsertPosition | undefined): string {
  if (!position) return 'i dokumentet'
  switch (position.at) {
    case 'start':
      return 'Läggs till först i dokumentet'
    case 'end':
      return 'Läggs till sist i dokumentet'
    case 'after':
      return `Läggs till efter "${position.heading}"`
    case 'before':
      return `Läggs till före "${position.heading}"`
  }
}

export function AddDocumentSectionRenderer({
  action,
  onApprove,
  onReject,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as AddDocumentSectionParams
  const chatDetail = useChatDetailSafe()

  const newSectionHeading = params.newSectionHeading ?? '(okänd rubrik)'
  const newSectionLevel = params.newSectionLevel ?? 2
  // CP-001 (AC 6): the document's natural-language title — never the id —
  // appears in the visible card copy.
  const documentTitle = params.documentTitle ?? 'styrdokumentet'

  const newNodes = Array.isArray(params.newSectionContentJson)
    ? params.newSectionContentJson
    : []
  const newExcerpt = plainText(newNodes).slice(0, 200)

  const summary = `Lägg till avsnittet "${newSectionHeading}" i ${documentTitle}`

  const openCanvas = () => {
    // AC 6: reuse the existing 'document-update' ChatDetailItem variant —
    // `oldSectionContentJson: []` makes the existing renderer show the `(tom)`
    // placeholder for the "Nuvarande" side automatically (verified at
    // components/features/ai-chat/details/document-update-detail.tsx:18-21).
    chatDetail?.openDetail({
      type: 'document-update',
      id: action.id,
      data: {
        pendingActionId: action.id,
        documentTitle,
        sectionHeading: newSectionHeading,
        oldSectionContentJson: [],
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
        Godkänt — avsnittet tillagt
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
      badge="Lägg till avsnitt"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      {...(secondaryAction !== undefined && { secondaryAction })}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Nytt avsnitt</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" variant="outline" className="text-[10px]">
              {newSectionHeading}
            </Badge>
            <Badge tone="neutral" variant="outline" className="text-[10px]">
              h{newSectionLevel}
            </Badge>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {positionLabelSv(params.position)}
          </p>
        </div>

        {params.changeSummary && (
          <div className="space-y-1">
            <span className={`${LABEL_CLS} block`}>Sammanfattning</span>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {params.changeSummary}
            </p>
          </div>
        )}

        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Nuvarande</span>
          <p className="line-clamp-3 text-[13px] leading-snug italic text-muted-foreground">
            (tom)
          </p>
        </div>

        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Föreslaget</span>
          <p className="line-clamp-3 text-[13px] leading-snug text-foreground">
            {newExcerpt || '(tom)'}
          </p>
        </div>
      </div>
    </ActionRendererFrame>
  )
}

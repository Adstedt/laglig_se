'use client'

/**
 * Story 14.24: DRAFT_DOCUMENT approval renderer (built on the shared 14.23 frame).
 * PENDING: editable title + plaintext excerpt with "Visa hela utkastet" (opens the
 * read-only draft in the chat detail panel — the canvas-ready seam, AC 11a),
 * dismissable context-link chips, and three controls — Öppna i editor (secondary,
 * via openDraftInEditor + router), Godkänn, Avvisa.
 * APPROVED: type badge + title + link to the created document (+ partial-link warning).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ArrowUpRight, Eye, PenLine, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { openDraftInEditor } from '@/app/actions/pending-agent-actions'
import { useChatDetailSafe } from '@/lib/ai/chat-detail-context'
import { DOCUMENT_TYPE_LABELS } from '@/components/features/documents/document-type-labels'
import type { AgentActionRendererProps } from './task-approval-renderer'
import {
  ActionRendererFrame,
  LABEL_CLS,
  useDebouncedParamsChange,
} from './renderer-frame'

type ContextLink = { kind: 'TASK' | 'LIST_ITEM'; id: string; title?: string }

interface DraftDocumentParams {
  title?: string
  docType?: string
  contentJson?: unknown
  contextLinks?: ContextLink[]
}

const LINK_KIND_LABEL: Record<string, string> = {
  TASK: 'Uppgift',
  LIST_ITEM: 'Lag', // a LawListItem — a law in the workspace's law list (not a kravpunkt)
}

interface TiptapNode {
  type?: string
  text?: string
  content?: TiptapNode[]
}
function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as TiptapNode
  if (typeof n.text === 'string') return n.text
  if (Array.isArray(n.content)) return n.content.map(plainText).join(' ')
  return ''
}

export function DraftDocumentRenderer({
  action,
  onApprove,
  onReject,
  onParamsChange,
  isSubmitting,
  compact = false,
}: AgentActionRendererProps) {
  const params = (action.params ?? {}) as DraftDocumentParams
  const router = useRouter()
  const chatDetail = useChatDetailSafe()
  const [title, setTitle] = useState(params.title ?? '')
  const [links, setLinks] = useState<ContextLink[]>(params.contextLinks ?? [])
  const [openingEditor, setOpeningEditor] = useState(false)

  // contentJson + docType are re-sent unchanged so a title/link edit doesn't drop
  // them (updatePendingActionParams replaces params wholesale).
  useDebouncedParamsChange(
    onParamsChange,
    {
      title,
      docType: params.docType,
      contentJson: params.contentJson,
      contextLinks: links,
    },
    action.status === 'PENDING'
  )

  const docTypeLabel = params.docType
    ? (DOCUMENT_TYPE_LABELS[params.docType] ?? params.docType)
    : 'Dokument'
  const effectiveTitle = title || params.title || ''
  const summary = `Utkast: ${docTypeLabel} "${effectiveTitle || 'namnlöst'}"`
  const full = plainText(params.contentJson).trim()
  const excerpt = full.slice(0, 160)

  const openCanvas = () => {
    chatDetail?.openDetail({
      type: 'document-draft',
      id: action.id,
      data: {
        pendingActionId: action.id,
        title: effectiveTitle,
        docType: params.docType ?? 'OTHER',
        contentJson: params.contentJson,
      },
    })
  }

  const handleOpenEditor = async () => {
    setOpeningEditor(true)
    try {
      const result = await openDraftInEditor(action.id)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Kunde inte öppna utkastet i editorn')
        return
      }
      router.push(
        `/workspace/styrdokument/${result.data.documentId}/edit?agentApprovalId=${action.id}`
      )
    } finally {
      setOpeningEditor(false)
    }
  }

  const removeLink = (idx: number) =>
    setLinks((prev) => prev.filter((_, i) => i !== idx))

  const resultRef = (action.result_ref ?? {}) as {
    documentId?: string
    partialLinkErrors?: unknown[]
  }
  const partialCount = Array.isArray(resultRef.partialLinkErrors)
    ? resultRef.partialLinkErrors.length
    : 0

  const approved = (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Godkänt — dokument skapat
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="neutral" variant="outline" className="text-[10px]">
          {docTypeLabel}
        </Badge>
        <span className="text-sm">{effectiveTitle}</span>
      </div>
      {resultRef.documentId && (
        <a
          href={`/workspace/styrdokument/${resultRef.documentId}/edit`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Öppna dokument
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
      {partialCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Dokument skapat, men {partialCount} koppling(ar) misslyckades.
        </p>
      )}
    </>
  )

  const secondaryAction = (
    <button
      type="button"
      onClick={handleOpenEditor}
      disabled={isSubmitting || openingEditor}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <PenLine className="h-3.5 w-3.5" />
      Öppna i editor
    </button>
  )

  return (
    <ActionRendererFrame
      status={action.status}
      compact={compact}
      badge="Utkast"
      summary={summary}
      approved={approved}
      onApprove={onApprove}
      onReject={onReject}
      isSubmitting={isSubmitting}
      canApprove={effectiveTitle.trim().length > 0}
      secondaryAction={secondaryAction}
    >
      <div className="space-y-1">
        <span className={`${LABEL_CLS} block`}>Titel</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dokumentets titel…"
          disabled={isSubmitting}
        />
      </div>

      {excerpt && (
        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Förhandsvisning</span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {excerpt}
            {full.length > 160 ? '…' : ''}
          </p>
        </div>
      )}

      {chatDetail && (
        <button
          type="button"
          onClick={openCanvas}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" />
          Visa hela utkastet
        </button>
      )}

      {links.length > 0 && (
        <div className="space-y-1">
          <span className={`${LABEL_CLS} block`}>Kopplas till</span>
          <div className="flex flex-wrap gap-1.5">
            {links.map((link, idx) => (
              <span
                key={`${link.kind}-${link.id}-${idx}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {link.title ?? LINK_KIND_LABEL[link.kind] ?? link.kind}
                <button
                  type="button"
                  onClick={() => removeLink(idx)}
                  disabled={isSubmitting}
                  aria-label="Ta bort koppling"
                  className="text-muted-foreground/60 transition-colors hover:text-foreground disabled:pointer-events-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </ActionRendererFrame>
  )
}

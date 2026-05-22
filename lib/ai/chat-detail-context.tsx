'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type {
  AssessmentStatus,
  ImpactLevel,
  TaskPriority,
  ComplianceStatus,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mirrors SourceInfo from resolveSource() in lib/ai/citations.ts */
export interface CitationDetailData {
  title: string
  snippet: string
  documentNumber: string
  slug: string
  anchorId?: string
  path?: string
  /** External URL for web search sources */
  url?: string
}

/** Subset of TaskWithRelations from app/actions/tasks.ts */
export interface TaskDetailData {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  column: { id: string; name: string; color: string; is_done: boolean }
  assignee: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  } | null
  created_at: Date
  list_item_links: Array<{
    law_list_item: {
      id: string
      document: { title: string; document_number: string }
      law_list: { id: string; name: string }
    }
  }>
}

/** From ChangeAssessment Prisma model + ChangeEvent context */
export interface AssessmentDetailData {
  changeEventId: string
  lawListItemId: string
  amendmentSfs: string
  changeType: string
  affectedSections: string[]
  effectiveDate: Date | null
  existingAssessment: {
    status: AssessmentStatus
    impactLevel: ImpactLevel
    aiAnalysis: string | null
    userNotes: string | null
  } | null
  documentTitle: string
  documentNumber: string
  /** Called when the user clicks "Klar" — navigates back to the parent view */
  onComplete?: () => void
}

/** Subset of LegalDocument Prisma model */
export interface DocumentDetailData {
  id: string
  title: string
  document_number: string
  slug: string
  content_type: string
  summary: string | null
  lawListItem?: {
    id: string
    complianceStatus: ComplianceStatus
    group: { id: string; name: string } | null
  }
}

/** Subset of LawListItem Prisma model + related document */
export interface LawListItemDetailData {
  id: string
  documentTitle: string
  documentNumber: string
  slug: string
  complianceStatus: ComplianceStatus
  group: { id: string; name: string } | null
  businessContext: string | null
  lastChangeAcknowledgedAt: Date | null
  lawListId: string
}

/**
 * Story 14.24: read-only preview of an agent-drafted styrdokument, opened in the
 * detail panel via the draft card's "Visa mer" (AC 11a — the canvas-ready seam).
 * This is a read-only preview, NOT a write-preview (those were removed in 14.23):
 * approval controls stay inline on the card. Story 14.33 upgrades this panel into
 * the responsive canvas. `documentId` is reserved for the Phase-3 existing-document
 * mode (Story 14.33 AC 5a) and is unused in 14.24.
 */
export interface DocumentDraftDetailData {
  pendingActionId: string
  title: string
  docType: string
  contentJson: unknown
  documentId?: string
}

/**
 * Discriminated union of detail types that can be displayed in the sidebar.
 * 14.15b added: 'task', 'assessment', 'document', 'law-list-item'.
 * Story 14.23 removed the write-action preview variant — write tools now render
 * inline approval cards, not a sidebar preview.
 * Story 14.24 added 'document-draft' (read-only agent draft preview).
 */
export type ChatDetailItem =
  | { type: 'citation'; id: string; data: CitationDetailData }
  | { type: 'tool-result'; id: string; toolName: string; data: unknown }
  | { type: 'task'; id: string; data: TaskDetailData }
  | { type: 'assessment'; id: string; data: AssessmentDetailData }
  | { type: 'document'; id: string; data: DocumentDetailData }
  | { type: 'law-list-item'; id: string; data: LawListItemDetailData }
  | { type: 'document-draft'; id: string; data: DocumentDraftDetailData }

// ---------------------------------------------------------------------------
// System messages (ephemeral, not persisted)
// ---------------------------------------------------------------------------

export interface SystemMessageItem {
  id: string
  text: string
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface ChatDetailContextValue {
  activeDetail: ChatDetailItem | null
  openDetail: (_item: ChatDetailItem, _triggerElement?: HTMLElement) => void
  closeDetail: () => void
  systemMessages: SystemMessageItem[]
  addSystemMessage: (_text: string) => void
  removeSystemMessage: (_id: string) => void
}

const ChatDetailContext = createContext<ChatDetailContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let systemMessageCounter = 0

export function ChatDetailProvider({ children }: { children: ReactNode }) {
  const [activeDetail, setActiveDetail] = useState<ChatDetailItem | null>(null)
  const [systemMessages, setSystemMessages] = useState<SystemMessageItem[]>([])
  const triggerRef = useRef<HTMLElement | null>(null)

  const openDetail = useCallback(
    (item: ChatDetailItem, triggerElement?: HTMLElement) => {
      setActiveDetail((prev) => {
        // Toggle: close if same type + id
        if (prev && prev.type === item.type && prev.id === item.id) {
          // Return focus to trigger on close
          if (triggerRef.current) {
            triggerRef.current.focus()
            triggerRef.current = null
          }
          return null
        }
        // Store the trigger element for focus return
        if (triggerElement) {
          triggerRef.current = triggerElement
        }
        return item
      })
    },
    []
  )

  const closeDetail = useCallback(() => {
    setActiveDetail(null)
    // Return focus to the element that triggered the sidebar
    if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [])

  const addSystemMessage = useCallback((text: string) => {
    const id = `sys-${++systemMessageCounter}-${Date.now()}`
    setSystemMessages((prev) => [...prev, { id, text, createdAt: new Date() }])
  }, [])

  const removeSystemMessage = useCallback((id: string) => {
    setSystemMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return (
    <ChatDetailContext.Provider
      value={{
        activeDetail,
        openDetail,
        closeDetail,
        systemMessages,
        addSystemMessage,
        removeSystemMessage,
      }}
    >
      {children}
    </ChatDetailContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatDetail() {
  const ctx = useContext(ChatDetailContext)
  if (!ctx) {
    throw new Error('useChatDetail must be used within a ChatDetailProvider')
  }
  return ctx
}

/**
 * Safe version that returns null when outside a provider.
 * Used by components that render in both provider and non-provider contexts
 * (e.g., citation pills in panel mode vs full mode).
 */
export function useChatDetailSafe() {
  return useContext(ChatDetailContext)
}

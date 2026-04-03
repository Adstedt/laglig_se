'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  useChatDetail,
  type ChatDetailItem,
} from '@/lib/ai/chat-detail-context'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { CitationDetail } from './details/citation-detail'
import { ToolResultDetail } from './details/tool-result-detail'
import { SearchResultsDetail } from './details/search-results-detail'
import { WritePreviewTask } from './details/write-preview-task'
import { WritePreviewStatus } from './details/write-preview-status'
import { WritePreviewNote } from './details/write-preview-note'
import { AssessmentDetail } from './details/assessment-detail'
import { TaskDetail } from './details/task-detail'
import { DocumentDetail } from './details/document-detail'
import { LawListItemDetail } from './details/law-list-item-detail'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Detail renderer — static switch on item.type
// ---------------------------------------------------------------------------

function DetailContent({ item }: { item: ChatDetailItem }) {
  switch (item.type) {
    case 'citation':
      return <CitationDetail data={item.data} />
    case 'tool-result':
      if (item.toolName === 'search_laws') {
        return <SearchResultsDetail data={item.data} />
      }
      return <ToolResultDetail toolName={item.toolName} data={item.data} />
    case 'write-preview':
      return <WritePreviewRouter toolName={item.toolName} data={item.data} />
    case 'assessment':
      return <AssessmentDetail data={item.data} />
    case 'task':
      return <TaskDetail data={item.data} />
    case 'document':
      return <DocumentDetail data={item.data} />
    case 'law-list-item':
      return <LawListItemDetail data={item.data} />
    default:
      return null
  }
}

/** Routes write-preview to the correct specialized card by tool name */
function WritePreviewRouter({
  toolName,
  data,
}: {
  toolName: string
  data: Extract<ChatDetailItem, { type: 'write-preview' }>['data']
}) {
  switch (toolName) {
    case 'create_task':
      return <WritePreviewTask data={data} />
    case 'update_compliance_status':
      return <WritePreviewStatus data={data} />
    case 'add_context_note':
      return <WritePreviewNote data={data} />
    default:
      return <ToolResultDetail toolName={toolName} data={data} />
  }
}

const WRITE_PREVIEW_HEADERS: Record<
  string,
  { title: string; subtitle: string }
> = {
  create_task: {
    title: 'Skapa uppgift',
    subtitle: 'Förhandsgranska och bekräfta',
  },
  update_compliance_status: {
    title: 'Uppdatera status',
    subtitle: 'Granska statusändring',
  },
  add_context_note: {
    title: 'Lägg till anteckning',
    subtitle: 'Granska anteckning',
  },
}

function getDetailHeader(item: ChatDetailItem): {
  title: string
  subtitle: string | null
} {
  switch (item.type) {
    case 'citation': {
      const path = item.data.path
      if (path) {
        return {
          title: `${item.data.title} › ${path}`,
          subtitle: item.data.documentNumber || null,
        }
      }
      return {
        title: item.data.title || 'Källa',
        subtitle: item.data.documentNumber || null,
      }
    }
    case 'tool-result':
      return {
        title:
          item.toolName === 'search_laws'
            ? 'Sökresultat'
            : item.toolName.replace(/_/g, ' '),
        subtitle: null,
      }
    case 'write-preview': {
      const header = WRITE_PREVIEW_HEADERS[item.toolName]
      return header
        ? { title: header.title, subtitle: header.subtitle }
        : { title: 'Bekräfta åtgärd', subtitle: null }
    }
    case 'assessment':
      return { title: 'Bedömning', subtitle: item.data.documentTitle }
    case 'task':
      return { title: item.data.title, subtitle: 'Uppgift' }
    case 'document':
      return { title: item.data.title, subtitle: item.data.document_number }
    case 'law-list-item':
      return {
        title: item.data.documentTitle,
        subtitle: item.data.documentNumber,
      }
    default:
      return { title: 'Detaljer', subtitle: null }
  }
}

// ---------------------------------------------------------------------------
// ChatDetailSidebar
// ---------------------------------------------------------------------------

export function ChatDetailSidebar() {
  const { activeDetail, closeDetail } = useChatDetail()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [contentKey, setContentKey] = useState(0)
  const [fadingIn, setFadingIn] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const isOpen = activeDetail !== null

  // Focus close button when sidebar opens
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Crossfade on content change
  useEffect(() => {
    if (!activeDetail) return
    setFadingIn(false)
    const timer = setTimeout(() => {
      setContentKey((k) => k + 1)
      setFadingIn(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [activeDetail?.type, activeDetail?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDetail()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeDetail])

  const header = activeDetail
    ? getDetailHeader(activeDetail)
    : { title: '', subtitle: null }

  // Mobile: bottom sheet instead of sidebar
  if (!isDesktop) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail()
        }}
      >
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>{header.title}</SheetTitle>
            {header.subtitle && (
              <p className="text-xs text-muted-foreground">{header.subtitle}</p>
            )}
          </SheetHeader>
          <div className="overflow-y-auto px-1 py-3">
            {activeDetail && <DetailContent item={activeDetail} />}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: sidebar panel
  return (
    <aside
      aria-label="Detaljpanel"
      className={cn(
        'shrink-0 border-l border-border overflow-hidden transition-all duration-300',
        isOpen ? 'w-[35%] min-w-[320px] max-w-[480px]' : 'w-0'
      )}
    >
      <div className="w-full h-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-start gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{header.title}</h2>
            {header.subtitle && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {header.subtitle}
              </p>
            )}
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={closeDetail}
            aria-label="Stäng detaljpanel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body with crossfade */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeDetail && (
            <div
              key={contentKey}
              className={cn(
                'transition-opacity duration-200',
                fadingIn ? 'opacity-100' : 'opacity-0'
              )}
            >
              <DetailContent item={activeDetail} />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

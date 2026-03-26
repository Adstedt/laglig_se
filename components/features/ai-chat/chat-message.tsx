'use client'

/**
 * Chat Message Component
 * Renders individual chat messages following AI SDK best practices:
 * iterate message.parts in order, render each part type with its own component.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStreamingText } from '@/lib/hooks/use-streaming-text'
import type { UIMessage } from 'ai'
import { isTextUIPart, isReasoningUIPart, isToolUIPart } from 'ai'
import {
  User,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  Building2,
  ClipboardList,
  MessageCircleQuestion,
  Check,
  X,
  Loader2,
  Brain,
  Trash2,
  Eye,
} from 'lucide-react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { CitationPillInline } from './citation-pill'
import { CitationSourceProvider } from '@/lib/ai/citation-context'
import { rehypeCitationPills } from '@/lib/ai/rehype-citation-pills'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MessageActions } from './message-actions'
import {
  hasCitationMarkers,
  sourcesToMap,
  type ChatMessageMetadata,
} from '@/lib/ai/citations'
import { cn } from '@/lib/utils'
import {
  useChatDetailSafe,
  type ChatDetailItem,
  type AssessmentDetailData,
} from '@/lib/ai/chat-detail-context'
import type { ToolMeta, WriteToolResponse } from '@/lib/agent/tools/types'

// ---------------------------------------------------------------------------
// Tool display configuration
// ---------------------------------------------------------------------------

const TOOL_CONFIG: Record<
  string,
  { label: string; doneLabel: string; icon: typeof Search; hidden?: boolean }
> = {
  search_laws: {
    label: 'Söker i lagdatabasen',
    doneLabel: 'Sökte i lagdatabasen',
    icon: Search,
  },
  get_document_details: {
    label: 'Hämtar dokument',
    doneLabel: 'Hämtade dokument',
    icon: FileText,
  },
  get_change_details: {
    label: 'Hämtar ändringsdetaljer',
    doneLabel: 'Hämtade ändringsdetaljer',
    icon: FileText,
  },
  get_company_context: {
    label: 'Hämtar företagskontext',
    doneLabel: 'Hämtade företagskontext',
    icon: Building2,
  },
  create_task: {
    label: 'Skapar uppgift',
    doneLabel: 'Skapade uppgift',
    icon: ClipboardList,
  },
  update_compliance_status: {
    label: 'Uppdaterar status',
    doneLabel: 'Uppdaterade status',
    icon: ClipboardList,
  },
  save_assessment: {
    label: 'Sparar bedömning',
    doneLabel: 'Sparade bedömning',
    icon: ClipboardList,
  },
  add_context_note: {
    label: 'Lägger till anteckning',
    doneLabel: 'Lade till anteckning',
    icon: ClipboardList,
  },
  suggest_followups: {
    label: 'Förbereder uppföljningsfrågor',
    doneLabel: 'Förberedde uppföljningsfrågor',
    icon: MessageCircleQuestion,
    hidden: true,
  },
}

// ---------------------------------------------------------------------------
// Tool part info extraction helper
// ---------------------------------------------------------------------------

interface ToolPartInfo {
  toolName: string
  input: Record<string, unknown> | undefined
  toolCallId: string
  toolOutput: unknown
  state: string
}

function extractToolPartInfo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any,
  fallbackIndex: number
): ToolPartInfo {
  const toolName: string =
    'toolName' in part ? part.toolName : part.type.replace('tool-', '')
  const input: Record<string, unknown> | undefined =
    'input' in part ? part.input : undefined
  const toolCallId: string =
    'toolInvocationId' in part ? part.toolInvocationId : `tool-${fallbackIndex}`
  const toolOutput: unknown = 'output' in part ? part.output : undefined
  const state: string = part.state ?? 'streaming'
  return { toolName, input, toolCallId, toolOutput, state }
}

// ---------------------------------------------------------------------------
// Part grouping — consecutive search_laws tool calls become a single group
// ---------------------------------------------------------------------------

type RenderItem =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'part'; part: any; index: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'search-group'; items: Array<{ part: any; index: number }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupSearchParts(parts: any[]): RenderItem[] {
  const result: RenderItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentGroup: Array<{ part: any; index: number }> = []

  const flushGroup = () => {
    if (currentGroup.length > 1) {
      result.push({ kind: 'search-group', items: [...currentGroup] })
    } else if (currentGroup.length === 1) {
      result.push({
        kind: 'part',
        part: currentGroup[0]!.part,
        index: currentGroup[0]!.index,
      })
    }
    currentGroup = []
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isSearch =
      isToolUIPart(part) &&
      ('toolName' in part ? part.toolName : part.type.replace('tool-', '')) ===
        'search_laws'

    if (isSearch) {
      currentGroup.push({ part, index: i })
    } else {
      flushGroup()
      result.push({ kind: 'part', part, index: i })
    }
  }
  flushGroup()
  return result
}

const streamdownPlugins = { code }

// Rehype plugins array — stable reference to avoid Streamdown re-renders
const citationRehypePlugins = [rehypeCitationPills]
const emptyRehypePlugins: typeof citationRehypePlugins = []

// Components mapping: <cite> → CitationPillInline
const citationComponents = {
  cite: CitationPillInline,
}
const emptyComponents = {}

const PROSE_CLASSES =
  'text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-li:my-0.5 prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:italic'

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  message: UIMessage
  showActions?: boolean
  isStreaming?: boolean
  onDelete?: ((_messageId: string) => void) | undefined
}

export function ChatMessage({
  message,
  showActions = true,
  isStreaming = false,
  onDelete,
}: ChatMessageProps) {
  const isUser = message.role === 'user'

  // Build source map from message metadata (hooks must be called unconditionally)
  const metadata = message.metadata as ChatMessageMetadata | undefined
  const sourceMap = useMemo(
    () => sourcesToMap(metadata?.citationSources),
    [metadata?.citationSources]
  )

  // All hooks must be called before any early return (rules-of-hooks)
  const parts = useMemo(() => message.parts ?? [], [message.parts])
  const renderItems = useMemo(() => groupSearchParts(parts), [parts])

  if (isUser) {
    const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
    return (
      <div className="group flex items-start gap-3 flex-row-reverse">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 overflow-hidden text-right">
          {textParts.map((part, index) => (
            <div
              key={`${message.id}-${index}`}
              className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            >
              <p className="whitespace-pre-wrap">
                {'text' in part ? part.text : ''}
              </p>
            </div>
          ))}
        </div>
        {onDelete && (
          <DeleteMessageButton onConfirm={() => onDelete(message.id)} />
        )}
      </div>
    )
  }

  // Assistant message — render parts in order per SDK best practice
  const isActive = isStreaming

  // Collect all text for copy action
  const fullText = parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('\n')

  return (
    <CitationSourceProvider sourceMap={sourceMap}>
      <div className="group flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
          <LexaIcon size={14} />
        </div>

        <div className="flex-1 overflow-hidden text-left space-y-3">
          {renderItems.map((item) => {
            if (item.kind === 'search-group') {
              return (
                <SearchToolGroup
                  key={`search-group-${item.items[0]!.index}`}
                  toolParts={item.items}
                />
              )
            }

            const { part, index } = item
            if (part.type === 'step-start') return null

            if (isReasoningUIPart(part)) {
              return (
                <ReasoningBlock
                  key={`reasoning-${index}`}
                  text={part.text}
                  state={part.state}
                />
              )
            }

            if (isToolUIPart(part)) {
              const { toolName, input, toolCallId, toolOutput } =
                extractToolPartInfo(part, index)
              const config = TOOL_CONFIG[toolName]
              if (config?.hidden) return null
              return (
                <ToolCallRow
                  key={`tool-${index}`}
                  toolCallId={toolCallId}
                  toolName={toolName}
                  state={part.state}
                  detail={getToolDetail(toolName, input)}
                  output={toolOutput}
                />
              )
            }

            if (isTextUIPart(part)) {
              return (
                <TextBlock
                  key={`text-${index}`}
                  text={part.text}
                  isStreaming={isActive && index === parts.length - 1}
                />
              )
            }

            return null
          })}

          <div className="flex items-center gap-1">
            {showActions && fullText.trim() && !isActive && (
              <MessageActions messageId={message.id} content={fullText} />
            )}
            {onDelete && !isActive && (
              <DeleteMessageButton onConfirm={() => onDelete(message.id)} />
            )}
          </div>
        </div>
      </div>
    </CitationSourceProvider>
  )
}

// ---------------------------------------------------------------------------
// ReasoningBlock — collapsible thinking section
// ---------------------------------------------------------------------------

function ReasoningBlock({
  text,
  state,
}: {
  text: string
  state?: 'streaming' | 'done' | undefined
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isThinking = state === 'streaming'

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}

        {isThinking ? (
          <Brain className="h-3.5 w-3.5 shrink-0 text-amber-500 animate-pulse" />
        ) : (
          <Brain className="h-3.5 w-3.5 shrink-0" />
        )}

        <span className="font-medium">
          {isThinking ? 'Resonerar...' : 'Resonerade'}
        </span>
      </button>

      {isOpen && (
        <div className="px-3 pb-2.5">
          <p className="text-xs text-muted-foreground leading-relaxed pl-1 whitespace-pre-wrap">
            {text}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchToolGroup — collapsed group for parallel search_laws calls
// ---------------------------------------------------------------------------

function SearchToolGroup({
  toolParts,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolParts: Array<{ part: any; index: number }>
}) {
  const [expanded, setExpanded] = useState(false)
  const chatDetail = useChatDetailSafe()

  const infos = useMemo(
    () => toolParts.map((tp) => extractToolPartInfo(tp.part, tp.index)),
    [toolParts]
  )

  const allDone = infos.every((i) => i.state === 'output-available')
  const anyError = infos.some((i) => i.state === 'output-error')
  const anyRunning = !allDone && !anyError

  const isClickable = allDone && chatDetail !== null

  // Build merged data for the sidebar (array of ToolResponse payloads)
  const mergedData = useMemo(() => {
    if (!allDone) return null
    return infos
      .map((i) => i.toolOutput)
      .filter(
        (o): o is Record<string, unknown> => o != null && typeof o === 'object'
      )
  }, [allDone, infos])

  const groupId = `search-group-${toolParts[0]!.index}`

  const isActiveInSidebar =
    isClickable && chatDetail?.activeDetail?.id === groupId

  const handleClick = useCallback(() => {
    if (!isClickable || !chatDetail || !mergedData) return
    chatDetail.openDetail({
      type: 'tool-result',
      id: groupId,
      toolName: 'search_laws',
      data: mergedData,
    })
  }, [isClickable, chatDetail, mergedData, groupId])

  const queries = infos
    .map((i) => (typeof i.input?.query === 'string' ? i.input.query : null))
    .filter(Boolean) as string[]

  const count = toolParts.length

  return (
    <div className="space-y-1">
      {/* Main collapsed row */}
      {isClickable ? (
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 py-1 px-3 rounded-lg border border-border/60 bg-muted/30 min-w-0',
            'cursor-pointer hover:bg-muted/50 transition-colors',
            isActiveInSidebar && 'ring-2 ring-primary/40'
          )}
          onClick={handleClick}
        >
          <div className="flex items-center justify-center h-5 w-5 rounded-full shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
          </div>
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            Sökte i lagdatabasen
          </span>
          <span className="text-xs text-muted-foreground/70">
            — {count} sökningar
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 py-1 px-3 rounded-lg border border-border/60 bg-muted/30 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center h-5 w-5 rounded-full shrink-0',
              anyRunning &&
                'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              anyError && 'bg-destructive/10 text-destructive'
            )}
          >
            {anyRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </div>
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <span
            className={cn(
              'text-xs',
              anyRunning ? 'text-foreground' : 'text-destructive'
            )}
          >
            {anyRunning ? 'Söker i lagdatabasen' : 'Sökning misslyckades'}
          </span>
          <span className="text-xs text-muted-foreground/70">
            — {count} sökningar
          </span>
        </div>
      )}

      {/* Expand toggle to show individual queries */}
      {queries.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors ml-3"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {expanded ? 'Dölj sökfrågor' : 'Visa sökfrågor'}
        </button>
      )}

      {expanded && queries.length > 0 && (
        <div className="ml-3 pl-3 border-l border-border/40 space-y-0.5">
          {queries.map((q, i) => (
            <p
              key={i}
              className="text-[11px] text-muted-foreground/70 truncate"
            >
              &ldquo;{q}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToolCallRow — inline tool call status
// ---------------------------------------------------------------------------

/**
 * Extract a short detail string from tool input for display in the tool row.
 */
function getToolDetail(
  toolName: string,
  input: Record<string, unknown> | undefined
): string | undefined {
  if (!input) return undefined
  switch (toolName) {
    case 'search_laws':
      return typeof input.query === 'string' ? `"${input.query}"` : undefined
    case 'get_document_details':
      return (input.documentNumber as string) ?? undefined
    case 'get_change_details':
      return (input.changeEventId as string) ?? undefined
    case 'create_task':
      return (input.title as string) ?? undefined
    case 'update_compliance_status':
      return (input.status as string) ?? undefined
    case 'save_assessment':
      return (input.title as string) ?? undefined
    case 'add_context_note':
      return typeof input.note === 'string'
        ? input.note.length > 40
          ? input.note.slice(0, 38) + '\u2026'
          : input.note
        : undefined
    default:
      return undefined
  }
}

/**
 * Build the ChatDetailItem for a tool result based on sidebarHint routing.
 * - save_assessment → 'assessment' detail type
 * - other write tools (confirmation_required) → 'write-preview'
 * - everything else → 'tool-result'
 */
function buildDetailItem(
  toolCallId: string,
  toolName: string,
  output: unknown
): ChatDetailItem {
  const isWritePreview =
    output &&
    typeof output === 'object' &&
    'confirmation_required' in output &&
    (output as { confirmation_required: boolean }).confirmation_required

  if (isWritePreview) {
    if (toolName === 'save_assessment') {
      // Route to assessment detail — extract data from the write tool response
      const writeResp = output as WriteToolResponse<unknown>
      const params = writeResp.params ?? {}
      const assessmentData: AssessmentDetailData = {
        changeEventId: (params.changeEventId as string) ?? '',
        lawListItemId: (params.lawListItemId as string) ?? '',
        amendmentSfs: (params.amendmentSfs as string) ?? '',
        changeType: (params.changeType as string) ?? '',
        affectedSections: (params.affectedSections as string[]) ?? [],
        effectiveDate: params.effectiveDate
          ? new Date(params.effectiveDate as string)
          : null,
        existingAssessment: params.existingAssessment
          ? (params.existingAssessment as AssessmentDetailData['existingAssessment'])
          : null,
        documentTitle: (params.documentTitle as string) ?? '',
        documentNumber: (params.documentNumber as string) ?? '',
      }
      return {
        type: 'assessment' as const,
        id: toolCallId,
        data: assessmentData,
      }
    }
    return {
      type: 'write-preview',
      id: toolCallId,
      toolName,
      data: output as WriteToolResponse<unknown>,
    }
  }

  return { type: 'tool-result', id: toolCallId, toolName, data: output }
}

function ToolCallRow({
  toolCallId,
  toolName,
  state,
  detail,
  output,
}: {
  toolCallId: string
  toolName: string
  state: string
  detail?: string | undefined
  output?: unknown
}) {
  const config = TOOL_CONFIG[toolName]
  const Icon = config?.icon ?? Search
  const chatDetail = useChatDetailSafe()
  const autoOpenedRef = useRef(false)

  const isDone = state === 'output-available'
  const isError = state === 'output-error'
  const isRunning = !isDone && !isError
  const isClickable = isDone && output !== undefined && chatDetail !== null

  const meta = isDone
    ? (output as { _meta?: ToolMeta } | null)?._meta
    : undefined
  const sidebarHint = meta?.sidebarHint

  // Auto-open sidebar for sidebarHint === 'open' (write previews)
  useEffect(() => {
    if (!isDone || !chatDetail || autoOpenedRef.current) return
    if (sidebarHint !== 'open' || !output) return
    // Debounce by 100ms to avoid layout flicker during streaming
    const timer = setTimeout(() => {
      autoOpenedRef.current = true
      chatDetail.openDetail(buildDetailItem(toolCallId, toolName, output))
    }, 100)
    return () => clearTimeout(timer)
  }, [isDone, sidebarHint, chatDetail, toolCallId, toolName, output])

  const label = isDone
    ? (config?.doneLabel ?? toolName)
    : isError
      ? `${config?.label ?? toolName} misslyckades`
      : (config?.label ?? toolName)

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isClickable || !chatDetail) return
    chatDetail.openDetail(
      buildDetailItem(toolCallId, toolName, output),
      e.currentTarget
    )
  }

  const handleSuggestClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!chatDetail || !output) return
    chatDetail.openDetail(
      buildDetailItem(toolCallId, toolName, output),
      e.currentTarget
    )
  }

  const isActiveInSidebar =
    isClickable && chatDetail?.activeDetail?.id === toolCallId

  function renderToolRowContent() {
    return (
      <>
        <div
          className={cn(
            'flex items-center justify-center h-5 w-5 rounded-full shrink-0',
            isDone &&
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            isError && 'bg-destructive/10 text-destructive',
            isRunning && 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          )}
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isDone ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </div>

        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
        <span
          className={cn(
            'text-xs',
            isDone
              ? 'text-muted-foreground'
              : isRunning
                ? 'text-foreground'
                : 'text-destructive'
          )}
        >
          {label}
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground/70 truncate">
            — {detail}
          </span>
        )}
      </>
    )
  }

  return (
    <div className="space-y-1.5">
      {isClickable ? (
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 py-1 px-3 rounded-lg border border-border/60 bg-muted/30 min-w-0',
            'cursor-pointer hover:bg-muted/50 transition-colors',
            isActiveInSidebar && 'ring-2 ring-primary/40'
          )}
          onClick={handleClick}
        >
          {renderToolRowContent()}
        </button>
      ) : (
        <div className="flex items-center gap-2 py-1 px-3 rounded-lg border border-border/60 bg-muted/30 min-w-0">
          {renderToolRowContent()}
        </div>
      )}

      {/* "Visa detaljer" chip for sidebarHint === 'suggest' */}
      {isDone && sidebarHint === 'suggest' && chatDetail && (
        <button
          type="button"
          onClick={handleSuggestClick}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ml-3"
        >
          <Eye className="h-3 w-3" />
          Visa detaljer
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeleteMessageButton — hover-revealed delete with confirmation dialog
// ---------------------------------------------------------------------------

function DeleteMessageButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Ta bort meddelande"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort meddelande?</AlertDialogTitle>
          <AlertDialogDescription>
            Meddelandet kommer att tas bort permanent. Detta kan inte ångras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Ta bort</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// TextBlock — markdown with rehype citation plugin
// ---------------------------------------------------------------------------

function TextBlock({
  text,
  isStreaming,
}: {
  text: string
  isStreaming: boolean
}) {
  if (isStreaming) {
    return <StreamingTextBlock text={text} />
  }

  const hasCitations = hasCitationMarkers(text)

  return (
    <div className={PROSE_CLASSES}>
      <Streamdown
        mode="static"
        plugins={streamdownPlugins}
        rehypePlugins={
          hasCitations ? citationRehypePlugins : emptyRehypePlugins
        }
        components={hasCitations ? citationComponents : emptyComponents}
        className="streamdown"
      >
        {text}
      </Streamdown>
    </div>
  )
}

/**
 * Streaming text block — citations are rendered inline via rehype plugin
 * as they appear. The plugin handles partial markers gracefully (only
 * complete [Källa: ...] brackets get transformed).
 */
function StreamingTextBlock({ text }: { text: string }) {
  const displayText = useStreamingText({ text, isStreaming: true, speed: 7 })
  const hasCitations = hasCitationMarkers(displayText)

  return (
    <div className={PROSE_CLASSES}>
      <Streamdown
        mode="streaming"
        isAnimating
        plugins={streamdownPlugins}
        rehypePlugins={
          hasCitations ? citationRehypePlugins : emptyRehypePlugins
        }
        components={hasCitations ? citationComponents : emptyComponents}
        className="streamdown"
      >
        {displayText}
      </Streamdown>
    </div>
  )
}

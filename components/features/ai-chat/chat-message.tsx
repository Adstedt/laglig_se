'use client'

/**
 * Chat Message Component
 * Renders individual chat messages following AI SDK best practices:
 * iterate message.parts in order, render each part type with its own component.
 */

import { useState, useMemo, useEffect, useId } from 'react'
import type { UIMessage } from 'ai'
import { isTextUIPart, isReasoningUIPart, isToolUIPart } from 'ai'
import {
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
// Part grouping — contiguous runs of completed (`output-available`) tool calls
// collapse into a single summary row via `CollapsedToolGroup`. Running,
// errored, non-tool, and hidden-tool parts flush the current group.
// ---------------------------------------------------------------------------

type RenderItem =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'part'; part: any; index: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'tool-group'; items: Array<{ part: any; index: number }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupCompletedToolParts(parts: any[]): RenderItem[] {
  const result: RenderItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentGroup: Array<{ part: any; index: number }> = []

  const flushGroup = () => {
    if (currentGroup.length >= 2) {
      result.push({ kind: 'tool-group', items: [...currentGroup] })
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
    // step-start parts are structural markers between multi-step tool calls.
    // They render as null and must not break a contiguous tool-group run.
    if (part?.type === 'step-start') continue
    if (!isToolUIPart(part)) {
      flushGroup()
      result.push({ kind: 'part', part, index: i })
      continue
    }
    const toolName =
      'toolName' in part ? part.toolName : part.type.replace('tool-', '')
    // Hidden tools (e.g. suggest_followups) are skipped entirely — they do not
    // appear in render and do not break a grouping run.
    if (TOOL_CONFIG[toolName]?.hidden) continue

    if (part.state === 'output-available') {
      currentGroup.push({ part, index: i })
    } else {
      flushGroup()
      result.push({ kind: 'part', part, index: i })
    }
  }
  flushGroup()
  return result
}

// Module-level dedup set for sidebar auto-open — keyed by toolCallId so that
// a tool call that transitions standalone → grouped mid-stream does not
// auto-open the sidebar twice. Bounded by tool call IDs per page lifetime.
const autoOpenedToolCallIds = new Set<string>()

/**
 * Test-only helper to reset the auto-open dedup set between test cases.
 * Prefixed with `__` to signal internal/test-only usage.
 */
export function __resetAutoOpenedForTests(): void {
  autoOpenedToolCallIds.clear()
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
  const renderItems = useMemo(() => groupCompletedToolParts(parts), [parts])

  if (isUser) {
    const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
    return (
      <div className="group flex items-start gap-2 flex-row-reverse">
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
      <div className="group overflow-hidden text-left space-y-3">
        {renderItems.map((item) => {
          if (item.kind === 'tool-group') {
            return (
              <CollapsedToolGroup
                key={`tool-group-${item.items[0]!.index}`}
                items={item.items}
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

        <div className="flex items-center gap-1 mt-2">
          {showActions && fullText.trim() && !isActive && (
            <MessageActions messageId={message.id} content={fullText} />
          )}
          {onDelete && !isActive && (
            <DeleteMessageButton onConfirm={() => onDelete(message.id)} />
          )}
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
// CollapsedToolGroup — summary row for contiguous runs of completed tool
// calls. Runs of the same tool coalesce into "Label (N)". Individual labels
// are clickable into the sidebar when the tool exposes a sidebarHint.
// ---------------------------------------------------------------------------

interface CoalescedRun {
  toolName: string
  count: number
  toolCallIds: string[]
  outputs: unknown[]
  firstIndex: number
}

function CollapsedToolGroup({
  items,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<{ part: any; index: number }>
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()
  const chatDetail = useChatDetailSafe()

  const infos = useMemo(
    () => items.map((it) => extractToolPartInfo(it.part, it.index)),
    [items]
  )

  // Coalesce consecutive runs of the same tool name into one labelled chip.
  const runs = useMemo<CoalescedRun[]>(() => {
    const out: CoalescedRun[] = []
    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]!
      const idx = items[i]!.index
      const last = out[out.length - 1]
      if (last && last.toolName === info.toolName) {
        last.count += 1
        last.toolCallIds.push(info.toolCallId)
        last.outputs.push(info.toolOutput)
      } else {
        out.push({
          toolName: info.toolName,
          count: 1,
          toolCallIds: [info.toolCallId],
          outputs: [info.toolOutput],
          firstIndex: idx,
        })
      }
    }
    return out
  }, [infos, items])

  const getRunDetailId = (run: CoalescedRun): string => {
    // Preserve the existing SearchToolGroup id format for backwards compat.
    if (run.toolName === 'search_laws') return `search-group-${run.firstIndex}`
    if (run.count >= 2) return `tool-group-${run.firstIndex}-${run.toolName}`
    return run.toolCallIds[0]!
  }

  const isRunClickable = (run: CoalescedRun): boolean => {
    if (!chatDetail) return false
    const firstOutput = run.outputs[0]
    if (!firstOutput || typeof firstOutput !== 'object') return false
    const meta = (firstOutput as { _meta?: ToolMeta })._meta
    const hint = meta?.sidebarHint
    return hint === 'open' || hint === 'suggest'
  }

  const handleRunClick = (run: CoalescedRun) => {
    if (!chatDetail) return
    if (run.toolName === 'search_laws') {
      const mergedData = run.outputs.filter(
        (o): o is Record<string, unknown> => o != null && typeof o === 'object'
      )
      chatDetail.openDetail({
        type: 'tool-result',
        id: getRunDetailId(run),
        toolName: 'search_laws',
        data: mergedData,
      })
      return
    }
    if (run.count >= 2) {
      const mergedData = run.outputs.filter(
        (o): o is Record<string, unknown> => o != null && typeof o === 'object'
      )
      chatDetail.openDetail({
        type: 'tool-result',
        id: getRunDetailId(run),
        toolName: run.toolName,
        data: mergedData,
      })
      return
    }
    chatDetail.openDetail(
      buildDetailItem(run.toolCallIds[0]!, run.toolName, run.outputs[0])
    )
  }

  return (
    <div className="space-y-0">
      {/* Headless auto-openers for items with sidebarHint === 'open'. These
          render nothing but fire the debounced openDetail on mount, guarded
          by the module-level autoOpenedToolCallIds dedup set. */}
      {infos.map((info) => {
        const output = info.toolOutput
        const meta =
          output && typeof output === 'object'
            ? (output as { _meta?: ToolMeta })._meta
            : undefined
        if (meta?.sidebarHint !== 'open') return null
        return (
          <ToolAutoOpener
            key={`auto-${info.toolCallId}`}
            toolCallId={info.toolCallId}
            toolName={info.toolName}
            output={output}
          />
        )
      })}

      {/* Single cohesive summary row: check · labels · chevron on right */}
      <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors min-w-0">
        <Check
          strokeWidth={2.5}
          className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0"
        />

        <div className="flex items-center gap-x-1.5 gap-y-0 flex-1 min-w-0 flex-wrap text-left">
          {runs.flatMap((run, i) => {
            const label =
              (TOOL_CONFIG[run.toolName]?.doneLabel ?? run.toolName) +
              (run.count > 1 ? ` (${run.count})` : '')
            const clickable = isRunClickable(run)
            const detailId = getRunDetailId(run)
            const isActive =
              clickable && chatDetail?.activeDetail?.id === detailId
            const doneLabel =
              TOOL_CONFIG[run.toolName]?.doneLabel ?? run.toolName

            const nodes: React.ReactNode[] = []
            if (i > 0) {
              nodes.push(
                <span
                  key={`sep-${run.firstIndex}-${run.toolName}`}
                  className="text-muted-foreground/40 text-xs select-none"
                  aria-hidden="true"
                >
                  ·
                </span>
              )
            }
            if (clickable) {
              nodes.push(
                <button
                  key={`run-${run.firstIndex}-${run.toolName}`}
                  type="button"
                  onClick={() => handleRunClick(run)}
                  aria-label={`Visa resultat: ${doneLabel}`}
                  className={cn(
                    'text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-sm -mx-0.5 px-0.5',
                    isActive && 'text-foreground bg-primary/10'
                  )}
                >
                  {label}
                </button>
              )
            } else {
              nodes.push(
                <span
                  key={`run-${run.firstIndex}-${run.toolName}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {label}
                </span>
              )
            }
            return nodes
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
          className="shrink-0 p-1 -mr-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/70 transition-colors"
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-200 ease-out',
              isExpanded && 'rotate-90'
            )}
          />
        </button>
      </div>

      {/* Expanded per-call rows — indented with hairline tree connector */}
      {isExpanded && (
        <div
          id={contentId}
          className="ml-4 pl-3 border-l border-border/50 space-y-0 mt-0.5 py-1 animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          {infos.map((info) => (
            <ToolCallRow
              key={`expanded-${info.toolCallId}`}
              toolCallId={info.toolCallId}
              toolName={info.toolName}
              state={info.state}
              detail={getToolDetail(info.toolName, info.input)}
              output={info.toolOutput}
              autoOpen={false}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToolAutoOpener — headless component that fires the debounced sidebar
// auto-open for a completed tool call, independent of whether the tool's
// visible row is mounted (collapsed group case). Dedups across remounts via
// the module-level `autoOpenedToolCallIds` Set.
// ---------------------------------------------------------------------------

function ToolAutoOpener({
  toolCallId,
  toolName,
  output,
}: {
  toolCallId: string
  toolName: string
  output: unknown
}) {
  const chatDetail = useChatDetailSafe()

  useEffect(() => {
    if (!chatDetail || !output) return
    if (autoOpenedToolCallIds.has(toolCallId)) return
    const timer = setTimeout(() => {
      if (autoOpenedToolCallIds.has(toolCallId)) return
      autoOpenedToolCallIds.add(toolCallId)
      chatDetail.openDetail(buildDetailItem(toolCallId, toolName, output))
    }, 100)
    return () => clearTimeout(timer)
  }, [chatDetail, output, toolCallId, toolName])

  return null
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
      return undefined // Hide cuid — label is self-explanatory
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
  autoOpen = true,
  compact = false,
}: {
  toolCallId: string
  toolName: string
  state: string
  detail?: string | undefined
  output?: unknown
  autoOpen?: boolean
  /**
   * Visual variant used when the row is rendered inside an expanded
   * `CollapsedToolGroup`. Drops the persistent row background and the
   * redundant "Visa detaljer" suggest-chip (the parent summary handles the
   * interaction affordance).
   */
  compact?: boolean
}) {
  const config = TOOL_CONFIG[toolName]
  const Icon = config?.icon ?? Search
  const chatDetail = useChatDetailSafe()

  const isDone = state === 'output-available'
  const isError = state === 'output-error'
  const isRunning = !isDone && !isError
  const isClickable = isDone && output !== undefined && chatDetail !== null

  const meta = isDone
    ? (output as { _meta?: ToolMeta } | null)?._meta
    : undefined
  const sidebarHint = meta?.sidebarHint

  // Auto-open sidebar for sidebarHint === 'open' (write previews). Deduped
  // via the module-level autoOpenedToolCallIds Set so a tool that transitions
  // standalone → grouped does not fire twice. `autoOpen={false}` is passed by
  // CollapsedToolGroup to the expanded rows because the dedicated
  // ToolAutoOpener handles the side-effect for grouped items.
  useEffect(() => {
    if (!autoOpen) return
    if (!isDone || !chatDetail) return
    if (sidebarHint !== 'open' || !output) return
    if (autoOpenedToolCallIds.has(toolCallId)) return
    const timer = setTimeout(() => {
      if (autoOpenedToolCallIds.has(toolCallId)) return
      autoOpenedToolCallIds.add(toolCallId)
      chatDetail.openDetail(buildDetailItem(toolCallId, toolName, output))
    }, 100)
    return () => clearTimeout(timer)
  }, [autoOpen, isDone, sidebarHint, chatDetail, toolCallId, toolName, output])

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
        {isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
        ) : isDone ? (
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <X className="h-3 w-3 text-destructive shrink-0" />
        )}

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
          <span className="text-xs text-muted-foreground/60 truncate min-w-0">
            — {detail}
          </span>
        )}
      </>
    )
  }

  const rowClasses = cn(
    'flex items-center gap-1.5 rounded-md min-w-0 overflow-hidden transition-colors',
    compact
      ? 'py-0.5 px-1.5 hover:bg-muted/40'
      : cn(
          'py-1 px-2.5',
          isDone && 'bg-muted/15',
          isRunning && 'bg-muted/25',
          isError && 'bg-destructive/5'
        )
  )

  return (
    <div className="space-y-1 ml-px">
      {isClickable ? (
        <button
          type="button"
          className={cn(
            rowClasses,
            'cursor-pointer hover:bg-muted/35 transition-colors',
            isActiveInSidebar && 'ring-1 ring-primary/30'
          )}
          onClick={handleClick}
        >
          {renderToolRowContent()}
        </button>
      ) : (
        <div className={rowClasses}>{renderToolRowContent()}</div>
      )}

      {/* "Visa detaljer" chip for sidebarHint === 'suggest' (standalone only —
          the parent summary row in a CollapsedToolGroup already exposes the
          sidebar affordance via the clickable label). */}
      {isDone && sidebarHint === 'suggest' && chatDetail && !compact && (
        <button
          type="button"
          onClick={handleSuggestClick}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors ml-2.5"
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
  const hasCitations = hasCitationMarkers(text)

  return (
    <div className={PROSE_CLASSES}>
      <Streamdown
        mode={isStreaming ? 'streaming' : 'static'}
        isAnimating={isStreaming}
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

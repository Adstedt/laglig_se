'use client'

/**
 * Chat Message Component
 * Renders individual chat messages following AI SDK best practices:
 * iterate message.parts in order, render each part type with its own component.
 */

import { useState } from 'react'
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
  Check,
  X,
  Loader2,
  Brain,
} from 'lucide-react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { CitationTooltip } from './citation-tooltip'
import { MessageActions } from './message-actions'
import { parseCitations, type Citation } from '@/lib/ai/citations'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Tool display configuration
// ---------------------------------------------------------------------------

const TOOL_CONFIG: Record<
  string,
  { label: string; doneLabel: string; icon: typeof Search }
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
}

const streamdownPlugins = { code }

const PROSE_CLASSES =
  'text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-li:my-0.5 prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:italic'

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  message: UIMessage
  citations?: Citation[]
  showActions?: boolean
  isStreaming?: boolean
}

export function ChatMessage({
  message,
  citations = [],
  showActions = true,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
    return (
      <div className="flex items-start gap-3 flex-row-reverse">
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
      </div>
    )
  }

  // Assistant message — render parts in order per SDK best practice
  const parts = message.parts ?? []
  const isActive = isStreaming

  // Collect all text for copy action
  const fullText = parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('\n')

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
        <LexaIcon size={14} />
      </div>

      <div className="flex-1 overflow-hidden text-left space-y-3">
        {parts.map((part, index) => {
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
            const toolName =
              'toolName' in part
                ? (part as { toolName: string }).toolName
                : part.type.replace('tool-', '')
            return (
              <ToolCallRow
                key={`tool-${index}`}
                toolName={toolName}
                state={part.state}
              />
            )
          }

          if (isTextUIPart(part)) {
            return (
              <TextBlock
                key={`text-${index}`}
                text={part.text}
                citations={citations}
                isStreaming={isActive && index === parts.length - 1}
              />
            )
          }

          return null
        })}

        {showActions && fullText.trim() && !isActive && (
          <MessageActions messageId={message.id} content={fullText} />
        )}
      </div>
    </div>
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
// ToolCallRow — inline tool call status
// ---------------------------------------------------------------------------

function ToolCallRow({ toolName, state }: { toolName: string; state: string }) {
  const config = TOOL_CONFIG[toolName]
  const Icon = config?.icon ?? Search

  const isDone = state === 'output-available'
  const isError = state === 'output-error'
  const isRunning = !isDone && !isError

  const label = isDone
    ? (config?.doneLabel ?? toolName)
    : isError
      ? `${config?.label ?? toolName} misslyckades`
      : (config?.label ?? toolName)

  return (
    <div className="flex items-center gap-2 py-1 px-3 rounded-lg border border-border/60 bg-muted/30">
      <div
        className={cn(
          'flex items-center justify-center h-5 w-5 rounded-full shrink-0',
          isDone && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// TextBlock — markdown text with optional citation support
// ---------------------------------------------------------------------------

function TextBlock({
  text,
  citations,
  isStreaming,
}: {
  text: string
  citations: Citation[]
  isStreaming: boolean
}) {
  const hasCitations =
    citations.length > 0 &&
    (text.includes('[Källa:') || text.includes('[1]') || text.includes('[2]'))

  if (hasCitations && !isStreaming) {
    return <MessageTextWithCitations text={text} citations={citations} />
  }

  // Separate component for streaming so the hook only mounts for the active stream
  if (isStreaming) {
    return <StreamingTextBlock text={text} />
  }

  return (
    <div className={PROSE_CLASSES}>
      <Streamdown
        mode="static"
        plugins={streamdownPlugins}
        className="streamdown"
      >
        {text}
      </Streamdown>
    </div>
  )
}

/** rAF typewriter decouples network chunks from rendering for smooth output */
function StreamingTextBlock({ text }: { text: string }) {
  const displayText = useStreamingText({ text, isStreaming: true, speed: 7 })

  return (
    <div className={PROSE_CLASSES}>
      <Streamdown
        mode="streaming"
        isAnimating
        plugins={streamdownPlugins}
        className="streamdown"
      >
        {displayText}
      </Streamdown>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MessageTextWithCitations — citation-aware renderer for completed messages
// ---------------------------------------------------------------------------

function MessageTextWithCitations({
  text,
  citations,
}: {
  text: string
  citations: Citation[]
}) {
  const { segments } = parseCitations(text)

  return (
    <div className="text-sm">
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <span key={index} className={PROSE_CLASSES}>
              <Streamdown
                mode="static"
                plugins={streamdownPlugins}
                className="streamdown"
              >
                {segment.content}
              </Streamdown>
            </span>
          )
        }

        const citationIndex = parseInt(segment.content, 10) - 1
        const citation = citations[citationIndex]

        if (!citation) {
          return (
            <span key={index} className="text-primary font-medium">
              [{segment.content}]
            </span>
          )
        }

        return (
          <CitationTooltip key={index} citation={citation}>
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium rounded-md bg-muted border border-border text-muted-foreground cursor-help hover:bg-muted/80 hover:text-foreground transition-colors">
              {segment.content}
            </span>
          </CitationTooltip>
        )
      })}
    </div>
  )
}

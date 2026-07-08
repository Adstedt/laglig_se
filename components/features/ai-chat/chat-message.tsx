'use client'

/**
 * Chat Message Component
 * Renders individual chat messages following AI SDK best practices:
 * iterate message.parts in order, render each part type with its own component.
 */

import { useState, useMemo, useEffect, useId } from 'react'
import type { UIMessage } from 'ai'
import type { ChatContextType } from '@/lib/hooks/use-chat-interface'
import { isTextUIPart, isReasoningUIPart, isToolUIPart } from 'ai'
import { AgentActionCard } from './agent-action-card'
import { AgentActionBatchCard } from './agent-action-batch-card'
import { AssistantAvatar } from './assistant-avatar'
import {
  ChevronRight,
  Search,
  FileText,
  FileEdit,
  FilePlus,
  Building2,
  ClipboardList,
  MessageCircleQuestion,
  Check,
  X,
  Loader2,
  Brain,
  Trash2,
  Eye,
  Globe,
  FileSearch,
  Paperclip,
  Image as ImageIcon,
  Sheet,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { getFileDownloadUrl } from '@/app/actions/files'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { CitationPillInline } from './citation-pill'
import { CitationSourceProvider } from '@/lib/ai/citation-context'
import { rehypeCitationPills } from '@/lib/ai/rehype-citation-pills'
import { useRotatingThinkingPhrase } from '@/lib/ai-chat/thinking-phrases'
import { useSmoothStream } from '@/lib/ai-chat/use-smooth-stream'
import {
  useElapsedSeconds,
  formatDuration,
} from '@/lib/ai-chat/use-elapsed-seconds'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { sourcesToMap, type ChatMessageMetadata } from '@/lib/ai/citations'
import { cn } from '@/lib/utils'
import {
  useChatDetailSafe,
  type ChatDetailItem,
  type AssessmentDetailData,
} from '@/lib/ai/chat-detail-context'
import type { ToolMeta } from '@/lib/agent/tools/types'
import {
  getAssessmentPreview,
  extractRecommendation,
} from '@/lib/changes/assessment-preview'

// ---------------------------------------------------------------------------
// Tool display configuration
// ---------------------------------------------------------------------------

const TOOL_CONFIG: Record<
  string,
  {
    label: string
    doneLabel: string
    /** Done-state label when the output is a proposal (carries pendingActionId). */
    proposalLabel?: string
    icon: typeof Search
    hidden?: boolean
  }
> = {
  search_laws: {
    label: 'Söker i lagdatabasen',
    doneLabel: 'Sökte i lagdatabasen',
    icon: Search,
  },
  // Story 7.7: semantic search over the workspace's kollektivavtal chunks.
  search_collective_agreements: {
    label: 'Söker i kollektivavtal',
    doneLabel: 'Sökte i kollektivavtal',
    icon: Search,
  },
  // Story 7.7: employee lookup for typed-name questions (employees:view-gated).
  lookup_employee: {
    label: 'Slår upp anställd',
    doneLabel: 'Slog upp anställd',
    icon: Search,
  },
  // Story 7.10: decrypted salary for löne-compliance (employees:manage-gated).
  get_employee_salary: {
    label: 'Hämtar löneuppgifter',
    doneLabel: 'Hämtade löneuppgifter',
    icon: Search,
  },
  // Story 17.9c: semantic search over the workspace's own uploaded files.
  search_workspace_files: {
    label: 'Söker i uppladdade filer',
    doneLabel: 'Sökte i uppladdade filer',
    icon: FileSearch,
  },
  // Story 19.2: read a full workspace file (PDF/image/extracted text).
  read_file: {
    label: 'Läser fil',
    doneLabel: 'Läste fil',
    icon: FileText,
  },
  // Story 19.4a: discovery over the company compliance graph.
  search_law_list_items: {
    label: 'Söker i laglistan',
    doneLabel: 'Sökte i laglistan',
    icon: Search,
  },
  search_tasks: {
    label: 'Söker bland uppgifter',
    doneLabel: 'Sökte bland uppgifter',
    icon: ClipboardList,
  },
  // Story 19.4: lazy entity-readers (compliance-graph traversal).
  get_law_list_item: {
    label: 'Läser laglistpost',
    doneLabel: 'Läste laglistpost',
    icon: ClipboardList,
  },
  get_task: {
    label: 'Läser uppgift',
    doneLabel: 'Läste uppgift',
    icon: ClipboardList,
  },
  list_linked_artifacts: {
    label: 'Hämtar länkade dokument',
    doneLabel: 'Hämtade länkade dokument',
    icon: FileText,
  },
  // Story 29.1: cycle read tier (lagefterlevnadskontroller).
  list_cycles: {
    label: 'Hämtar lagefterlevnadskontroller',
    doneLabel: 'Hämtade lagefterlevnadskontroller',
    icon: ClipboardList,
  },
  get_cycle: {
    label: 'Läser kontroll',
    doneLabel: 'Läste kontroll',
    icon: ClipboardList,
  },
  get_finding: {
    label: 'Läser avvikelse',
    doneLabel: 'Läste avvikelse',
    icon: AlertTriangle,
  },
  // Story 19.3: workspace-wide diagnostic aggregates.
  list_bevis_gaps: {
    label: 'Letar efter bevisluckor',
    doneLabel: 'Hittade bevisluckor',
    icon: AlertTriangle,
  },
  list_unassessed_changes: {
    label: 'Letar efter obedömda ändringar',
    doneLabel: 'Hittade obedömda ändringar',
    icon: FileSearch,
  },
  list_overdue: {
    label: 'Letar efter försenade uppgifter',
    doneLabel: 'Hittade försenade uppgifter',
    icon: Clock,
  },
  list_stale_documents: {
    label: 'Letar efter dokument att granska',
    doneLabel: 'Hittade dokument att granska',
    icon: FileText,
  },
  // Story 19.7a: load a skill's instructions mid-conversation.
  activate_skill: {
    label: 'Aktiverar färdighet',
    doneLabel: 'Aktiverade färdighet',
    icon: Brain,
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
    label: 'Föreslår uppgift',
    doneLabel: 'Skapade uppgift',
    proposalLabel: 'Föreslog uppgift',
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
  // Story 14.23 write tools — were rendering raw tool names (no config entry).
  add_obligation: {
    label: 'Lägger till kravpunkt',
    doneLabel: 'Lade till kravpunkt',
    proposalLabel: 'Föreslog kravpunkt',
    icon: ClipboardList,
  },
  // Story 14.28: propose an edit to a kravpunkt.
  update_requirement: {
    label: 'Ändrar kravpunkt',
    doneLabel: 'Ändrade kravpunkt',
    proposalLabel: 'Föreslog ändring av kravpunkt',
    icon: ClipboardList,
  },
  link_task_to_document: {
    label: 'Länkar dokument',
    doneLabel: 'Länkade dokument',
    proposalLabel: 'Föreslog länkning',
    icon: FileText,
  },
  link_document_to_task: {
    label: 'Länkar dokument till uppgift',
    doneLabel: 'Länkade dokument till uppgift',
    proposalLabel: 'Föreslog länkning',
    icon: ClipboardList,
  },
  assign_task: {
    label: 'Tilldelar uppgift',
    doneLabel: 'Tilldelade uppgift',
    proposalLabel: 'Föreslog tilldelning',
    icon: ClipboardList,
  },
  suggest_followups: {
    label: 'Förbereder uppföljningsfrågor',
    doneLabel: 'Förberedde uppföljningsfrågor',
    icon: MessageCircleQuestion,
    hidden: true,
  },
  web_search: {
    label: 'Söker på webben',
    doneLabel: 'Sökte på webben',
    icon: Globe,
  },
  // Story 14.24: drafting a full styrdokument generates the whole Tiptap doc as
  // tool input — this can run several seconds, so the running label matters.
  draft_styrdokument: {
    label: 'Skriver utkast',
    doneLabel: 'Skapade utkast',
    proposalLabel: 'Skrev utkast',
    icon: FileText,
  },
  // Story 14.29: agent-proposed task comment (always a proposal — the
  // proposalLabel is what the chip actually shows; doneLabel is the
  // never-used direct-write fallback).
  add_task_comment: {
    label: 'Föreslår kommentar',
    doneLabel: 'Lade till kommentar',
    proposalLabel: 'Föreslog kommentar',
    icon: ClipboardList,
  },
  // Story 14.30: agent-proposed styrdokument status transition. Always a
  // proposal — APPROVED is forbidden at both tool + dispatch layers
  // (separation of duties); the proposalLabel is what the chip shows.
  transition_document_status: {
    label: 'Föreslår statusändring',
    doneLabel: 'Ändrade status',
    proposalLabel: 'Föreslog statusändring',
    icon: FileText,
  },
  // Story 17.11: agent-proposed section-level edit to an existing styrdokument.
  // Always a proposal — inline approval card is the only finalize path. Both
  // PENDING + DONE labels per the 1428-001 owner-smoke finding.
  update_document: {
    label: 'Uppdaterar dokument',
    doneLabel: 'Uppdaterade dokument',
    proposalLabel: 'Föreslog ändring',
    icon: FileEdit,
  },
  // Story 17.11b: agent-proposed insert of a NEW section into an existing
  // styrdokument. Always a proposal — inline approval card is the only
  // finalize path. Both PENDING + DONE labels per the 1428-001 owner-smoke
  // finding.
  add_document_section: {
    label: 'Lägger till avsnitt',
    doneLabel: 'Lade till avsnitt',
    proposalLabel: 'Föreslog nytt avsnitt',
    icon: FilePlus,
  },
  // Story 17.10: workspace-document reads (styrdokument).
  search_workspace_documents: {
    label: 'Söker i styrdokument',
    doneLabel: 'Sökte i styrdokument',
    icon: FileSearch,
  },
  get_workspace_document: {
    label: 'Läser styrdokument',
    doneLabel: 'Läste styrdokument',
    icon: FileText,
  },
  list_workspace_documents: {
    label: 'Listar styrdokument',
    doneLabel: 'Listade styrdokument',
    icon: FileText,
  },
}

/**
 * Tools whose result is allowed to open the detail sidebar when clicked.
 *
 * Single source of truth for tool-row clickability — consulted by BOTH the
 * grouped summary (`isRunClickable`) and the standalone row (`isClickable`).
 * Only tools with a purpose-built, user-facing detail view qualify:
 *   - search_laws → SearchResultsDetail
 *   - web_search  → WebSearchDetail
 * Every other tool falls through to the generic JSON dump (ToolResultDetail),
 * which exposes internal data (e.g. activate_skill's full skill instructions,
 * raw list_workspace_documents metadata). Those render as non-clickable status
 * lines instead — surface value, never internals.
 */
const EXPANDABLE_TOOLS = new Set<string>(['search_laws', 'web_search'])

function isToolResultExpandable(toolName: string): boolean {
  return EXPANDABLE_TOOLS.has(toolName)
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

type WebSourceRef = { url: string; title?: string | undefined }

type RenderItem =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'part'; part: any; index: number; webSources?: WebSourceRef[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'tool-group'; items: Array<{ part: any; index: number }> }
  // Story 19.15: a contiguous run that contains at least one reasoning step
  // (interleaved thinking) collapses into one "Arbetsförlopp" summary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { kind: 'progress-group'; items: Array<{ part: any; index: number }> }

// Story 14.23: inline agent approval cards are the only approval path. The
// inline-approvals feature flag and the legacy sidebar preview fallback were
// removed — proposal-carrying tool parts always render as an inline
// AgentActionCard (1 row) or AgentActionBatchCard (2+ rows per message).

/** Read `output.data.pendingActionId` from a tool result, if present. */
function extractPendingActionId(output: unknown): string | null {
  if (!output || typeof output !== 'object') return null
  const data = (output as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  const id = (data as { pendingActionId?: unknown }).pendingActionId
  return typeof id === 'string' ? id : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupCompletedToolParts(parts: any[]): RenderItem[] {
  const result: RenderItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentGroup: Array<{ part: any; index: number }> = []
  // Track whether we've seen text AFTER a tool call has completed.
  // Source-url parts before tool completion are search-result metadata
  // (not inline citations) and should be skipped.
  let hasSeenToolResult = false
  let hasSeenPostToolText = false

  const flushGroup = () => {
    if (currentGroup.length === 0) {
      currentGroup = []
      return
    }
    // Story 19.15: a group containing at least one reasoning step (interleaved
    // thinking) collapses into one "Arbetsförlopp" progress summary when there
    // are 2+ steps; a lone reasoning step degrades to the plain "Tänkte klart"
    // breadcrumb (AC 9). Tool-only groups keep the existing CollapsedToolGroup
    // behaviour untouched.
    const hasReasoning = currentGroup.some((it) => isReasoningUIPart(it.part))
    if (hasReasoning && currentGroup.length >= 2) {
      result.push({ kind: 'progress-group', items: [...currentGroup] })
    } else if (!hasReasoning && currentGroup.length >= 2) {
      result.push({ kind: 'tool-group', items: [...currentGroup] })
    } else {
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

    // Story 14.21: source-url parts from web search.
    // Store as metadata on the preceding text render item — rendered as
    // separate pill elements outside Streamdown. This keeps DB citations
    // (processed by rehypeCitationPills inside Streamdown) working normally.
    if (part?.type === 'source-url') {
      if (!hasSeenPostToolText) continue
      const last = result[result.length - 1]
      if (last?.kind === 'part' && isTextUIPart(last.part)) {
        if (!last.webSources) last.webSources = []
        last.webSources.push({
          url: part.url as string,
          title: part.title as string | undefined,
        })
      }
      continue
    }

    // Story 19.15: completed reasoning parts (interleaved thinking) join the
    // current progress group instead of flushing it; a still-streaming
    // reasoning part is skipped here (it is represented by the live working
    // row and folded once done) and must NOT break a contiguous run.
    if (isReasoningUIPart(part)) {
      if (part.state === 'done') {
        currentGroup.push({ part, index: i })
      }
      continue
    }

    if (!isToolUIPart(part)) {
      flushGroup()
      // Merge adjacent text parts for markdown continuity.
      // Stop merging when the previous item has webSources — this creates
      // per-section pill groups instead of clustering all at the bottom.
      if (isTextUIPart(part)) {
        if (hasSeenToolResult) hasSeenPostToolText = true
        const prev = result[result.length - 1]
        if (
          prev?.kind === 'part' &&
          isTextUIPart(prev.part) &&
          !prev.webSources?.length
        ) {
          prev.part = {
            ...prev.part,
            text: prev.part.text + (part.text as string),
          }
          continue
        }
        result.push({ kind: 'part', part, index: i })
        continue
      }
      result.push({ kind: 'part', part, index: i })
      continue
    }
    const toolName =
      'toolName' in part ? part.toolName : part.type.replace('tool-', '')
    // Hidden tools (e.g. suggest_followups) are skipped entirely — they do not
    // appear in render and do not break a grouping run.
    if (TOOL_CONFIG[toolName]?.hidden) continue

    if (part.state === 'output-available') {
      hasSeenToolResult = true
      // Story 19.4 follow-up (1a): proposal-carrying tool parts now coalesce
      // like any other tool — a batch of N same-tool proposals shows
      // "Föreslog kravpunkt (N)" instead of N stacked rows. Safe because the
      // approval card renders once at message level from `pendingApprovalIds`
      // (decoupled from these chips); a lone proposal still renders as a
      // single-item row (count 1).
      currentGroup.push({ part, index: i })
    } else {
      flushGroup()
      result.push({ kind: 'part', part, index: i })
    }
  }
  flushGroup()

  // No trailing flush needed — source-url parts without preceding text are skipped
  return result
}

// Module-level dedup set for sidebar auto-open — keyed by toolCallId so that
// a tool call that transitions standalone → grouped mid-stream does not
// auto-open the sidebar twice. Bounded by tool call IDs per page lifetime.
// ---------------------------------------------------------------------------
// Web source deduplication — collapse repeated URLs into one pill + count
// ---------------------------------------------------------------------------

type DeduplicatedSource = {
  url: string
  title: string | undefined
  domain: string
  count: number
}

function deduplicateWebSources(sources: WebSourceRef[]): DeduplicatedSource[] {
  const seen = new Map<string, DeduplicatedSource>()
  for (const src of sources) {
    const existing = seen.get(src.url)
    if (existing) {
      existing.count++
    } else {
      let domain: string
      try {
        domain = new URL(src.url).hostname.replace(/^www\./, '')
      } catch {
        domain = src.url
      }
      seen.set(src.url, { url: src.url, title: src.title, domain, count: 1 })
    }
  }
  return Array.from(seen.values())
}

// ---------------------------------------------------------------------------
// Källor accordion — aggregates all unique sources (web + DB) for the message
// ---------------------------------------------------------------------------

type AccordionSource =
  | { kind: 'web'; url: string; domain: string; title: string | null }
  | {
      kind: 'db'
      documentNumber: string
      title: string | null
      slug: string
      anchorId: string | null
    }

/**
 * Extract document numbers actually cited in text via [Källa: ...] or
 * [Utkast: ...] markers (17.10b — Utkast is the draft-tier citation form).
 */
function extractCitedDocNumbers(text: string): Set<string> {
  const cited = new Set<string>()
  const re = /\[(?:Källa|Utkast):\s*([^\]]+)\]/g
  let match
  while ((match = re.exec(text)) !== null) {
    const label = match[1]!.trim()
    // Extract document number (everything before first comma)
    const commaIdx = label.indexOf(',')
    cited.add(commaIdx >= 0 ? label.slice(0, commaIdx).trim() : label)
  }
  return cited
}

/** Check if get_document_details was called (its results should show in accordion) */
function extractDocDetailDocNumbers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[]
): Set<string> {
  const docs = new Set<string>()
  for (const part of parts) {
    if (
      isToolUIPart(part) &&
      'toolName' in part &&
      part.toolName === 'get_document_details' &&
      part.state === 'output-available' &&
      'output' in part
    ) {
      const output = part.output as
        | { data?: { documentNumber?: string } }
        | undefined
      if (output?.data?.documentNumber) {
        docs.add(output.data.documentNumber)
      }
    }
  }
  return docs
}

function collectAccordionSources(
  sourceMap: Map<string, import('@/lib/ai/citations').SourceInfo>,
  fullText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[]
): AccordionSource[] {
  const citedDocs = extractCitedDocNumbers(fullText)
  const detailDocs = extractDocDetailDocNumbers(parts)
  const includedDocs = new Set([...citedDocs, ...detailDocs])

  const webSeen = new Map<string, AccordionSource>()
  const dbSeen = new Map<string, AccordionSource>()

  for (const [, info] of sourceMap) {
    if (info.url) {
      // Web sources — always include (they're explicitly referenced)
      if (!webSeen.has(info.url)) {
        let domain: string
        try {
          domain = new URL(info.url).hostname.replace(/^www\./, '')
        } catch {
          domain = info.url
        }
        webSeen.set(info.url, {
          kind: 'web',
          url: info.url,
          domain,
          title: info.title,
        })
      }
    } else if (info.slug && includedDocs.has(info.documentNumber)) {
      // DB sources — only include if actually cited or fetched via get_document_details
      if (!dbSeen.has(info.documentNumber)) {
        dbSeen.set(info.documentNumber, {
          kind: 'db',
          documentNumber: info.documentNumber,
          title: info.title,
          slug: info.slug,
          anchorId: info.anchorId,
        })
      }
    }
  }

  return [...Array.from(dbSeen.values()), ...Array.from(webSeen.values())]
}

function SourcesAccordion({
  sourceMap,
  fullText,
  parts,
}: {
  sourceMap: Map<string, import('@/lib/ai/citations').SourceInfo>
  fullText: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[]
}) {
  const chatDetail = useChatDetailSafe()
  const sources = useMemo(
    () => collectAccordionSources(sourceMap, fullText, parts),
    [sourceMap, fullText, parts]
  )

  if (sources.length === 0) return null

  const handleDbClick = (src: Extract<AccordionSource, { kind: 'db' }>) => {
    if (!chatDetail) return
    chatDetail.openDetail({
      type: 'citation' as const,
      id: `citation-${src.documentNumber}-doc`,
      data: {
        title: src.title ?? '',
        snippet: '',
        documentNumber: src.documentNumber,
        slug: src.slug,
        ...(src.anchorId ? { anchorId: src.anchorId } : {}),
      },
    })
  }

  return (
    <Collapsible className="group/sources">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
        <ChevronRight className="h-3 w-3 transition-transform duration-200 ease-out group-data-[state=open]/sources:rotate-90" />
        Källor ({sources.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-0.5 animate-in fade-in duration-300">
          {sources.map((src) => {
            if (src.kind === 'web') {
              return (
                <a
                  key={`web-${src.url}`}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer min-w-0"
                >
                  <Globe className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {src.title ? `${src.domain} — ${src.title}` : src.domain}
                  </span>
                </a>
              )
            }
            return (
              <button
                key={`db-${src.documentNumber}`}
                type="button"
                onClick={() => handleDbClick(src)}
                className="flex items-center gap-2 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer min-w-0 w-full text-left"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {src.documentNumber}
                  {src.title ? ` — ${src.title}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

const autoOpenedToolCallIds = new Set<string>()

/**
 * Test-only helper to reset the auto-open dedup set between test cases.
 * Prefixed with `__` to signal internal/test-only usage.
 */
export function __resetAutoOpenedForTests(): void {
  autoOpenedToolCallIds.clear()
}

const streamdownPlugins = { code }

// Render a streaming message as ONE block so the fade is a single global,
// monotonic pass (newest word fades, everything before it is already settled).
// With per-block rendering Streamdown animates each block on its own clock, so a
// burst makes two paragraphs fade in parallel. Stable reference — an inline
// function would give Streamdown a new identity every render.
const SINGLE_BLOCK = (markdown: string): string[] => [markdown]

// Rehype plugins array — stable reference to avoid Streamdown re-renders
const citationRehypePlugins = [rehypeCitationPills]

// Components mapping: <cite> → CitationPillInline
const citationComponents = {
  cite: CitationPillInline,
}

const PROSE_CLASSES =
  'text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-loose prose-p:my-3 prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3 prose-ul:my-3 prose-li:my-1 prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:italic'

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  message: UIMessage
  showActions?: boolean
  isStreaming?: boolean
  onDelete?: ((_messageId: string) => void) | undefined
  contextType?: ChatContextType | undefined
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

  // Story 14.22: pending-approval ids for this message — union of live tool-part
  // outputs and the persisted `metadata.pendingActionIds` (so the inline card is
  // rediscoverable on history reload, where tool parts no longer exist). Rendered
  // once at message level, gated on !isActive (see render below).
  const pendingApprovalIds = useMemo(() => {
    const ids = new Set<string>()
    for (const part of parts) {
      if (
        isToolUIPart(part) &&
        part.state === 'output-available' &&
        'output' in part
      ) {
        const id = extractPendingActionId(part.output)
        if (id) ids.add(id)
      }
    }
    const metaIds = (metadata as { pendingActionIds?: string[] } | undefined)
      ?.pendingActionIds
    if (Array.isArray(metaIds)) for (const id of metaIds) ids.add(id)
    return Array.from(ids)
  }, [parts, metadata])

  // Story 19.15: elapsed-time counter for the live "working" indicator. Hook
  // must run before the isUser early return (rules-of-hooks); only used in the
  // assistant branch below. Runs only for the active (newest streaming)
  // assistant turn and freezes on finish; returns null on history reload (the
  // clock never started → the duration is omitted from the summary).
  const elapsedSeconds = useElapsedSeconds(
    isStreaming && message.role === 'assistant'
  )

  // True while the last text block is still fading its words in — including the
  // brief drain after the stream ends (see useSmoothStream). Used to hold the
  // message's done-UI until the text has fully appeared. Declared before the
  // isUser early return to keep hook order stable.
  const [lastTextRevealing, setLastTextRevealing] = useState(false)

  if (isUser) {
    const textParts = message.parts?.filter((p) => p.type === 'text') ?? []
    // Story 19.1: chat attachment chips persisted on the user message metadata.
    const attachments =
      (
        metadata as
          | {
              attachments?: Array<{
                fileId: string
                filename: string
                mimeType: string | null
              }>
            }
          | undefined
      )?.attachments ?? []
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
          {attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
              {attachments.map((att) => {
                const mime = att.mimeType ?? ''
                const Icon =
                  mime === 'application/pdf'
                    ? FileText
                    : mime.startsWith('image/')
                      ? ImageIcon
                      : mime.includes('sheet') ||
                          mime.includes('excel') ||
                          mime === 'text/csv'
                        ? Sheet
                        : Paperclip
                return (
                  <button
                    key={att.fileId}
                    type="button"
                    onClick={async () => {
                      const res = await getFileDownloadUrl(att.fileId)
                      if (res.success && res.data) {
                        window.open(
                          res.data.url,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                    }}
                    title={`Öppna ${att.filename}`}
                    className="inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-foreground/80 hover:bg-muted"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{att.filename}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {onDelete && (
          <DeleteMessageButton onConfirm={() => onDelete(message.id)} />
        )}
      </div>
    )
  }

  // Assistant message — render parts in order per SDK best practice
  const isActive = isStreaming

  // The streaming text keeps fading in for a beat after the stream ends while
  // the reveal buffer drains. Gate the done-UI (actions, sources, approval
  // cards, web-source pills) on the text having fully appeared — not just on the
  // stream status — so they don't pop in over still-typing text.
  const lastTextIndex = parts.reduce(
    (acc, p, i) => (isTextUIPart(p) ? i : acc),
    -1
  )
  const turnSettled = !isActive && !lastTextRevealing

  // Collect all text for copy action
  const fullText = parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join('\n')

  // Story 19.15: the "working" phase of an active turn — the agent is reasoning
  // and/or calling tools but has not begun the answer yet. During this phase a
  // single live status row renders beside the avatar (AC 1) and the per-step
  // reasoning/tool rows are suppressed (folded into the collapsed summary once
  // the turn settles). The phase ends as soon as answer text starts streaming.
  const hasAnswerText = parts.some(
    (p) => isTextUIPart(p) && p.text.trim().length > 0
  )
  const isWorking = isActive && !hasAnswerText

  // Story 19.15 (QA-001): the elapsed duration is a turn-level total. When
  // intermediate answer text splits a turn into several progress groups, show
  // the frozen duration once — on the LAST progress group — rather than
  // repeating the same total on every group (which made a 2-step group read as
  // "· 2m 27s").
  const lastProgressGroupIndex = renderItems.reduce(
    (acc, item, idx) => (item.kind === 'progress-group' ? idx : acc),
    -1
  )

  return (
    <CitationSourceProvider sourceMap={sourceMap}>
      <div className="group overflow-hidden text-left space-y-3">
        {isWorking ? (
          // Story 19.15: the live "working" phase — a single status row sits
          // beside the (stable) avatar and updates in place; the per-step
          // reasoning/tool rows are suppressed so there is no ladder.
          <div className="flex items-center gap-2.5">
            <AssistantAvatar />
            <LiveWorkingStatus parts={parts} elapsedSeconds={elapsedSeconds} />
          </div>
        ) : (
          <AssistantAvatar />
        )}
        <div className="min-w-0 overflow-hidden text-left space-y-3">
          {/* Story 19.15: during the live working phase the per-step rows are
              suppressed (the live row beside the avatar represents them). The
              headless auto-openers still fire so write-preview tools open the
              sidebar even while their chips are hidden. */}
          {isWorking && <WorkingAutoOpeners parts={parts} />}
          {!isWorking &&
            renderItems.map((item, itemIdx) => {
              if (item.kind === 'tool-group') {
                return (
                  <CollapsedToolGroup
                    key={`tool-group-${item.items[0]!.index}`}
                    items={item.items}
                  />
                )
              }

              if (item.kind === 'progress-group') {
                return (
                  <AgentProgressGroup
                    key={`progress-group-${item.items[0]!.index}`}
                    items={item.items}
                    durationLabel={
                      !isActive &&
                      elapsedSeconds !== null &&
                      itemIdx === lastProgressGroupIndex
                        ? formatDuration(elapsedSeconds)
                        : undefined
                    }
                  />
                )
              }

              const { part, index } = item
              if (part.type === 'step-start') return null

              if (isReasoningUIPart(part)) {
                return (
                  <ReasoningBlock
                    key={`reasoning-${index}`}
                    state={part.state}
                  />
                )
              }

              if (isToolUIPart(part)) {
                const { toolName, input, toolCallId, toolOutput } =
                  extractToolPartInfo(part, index)
                const config = TOOL_CONFIG[toolName]
                if (config?.hidden) return null
                // Story 14.23: a proposal tool (pendingActionId in output) suppresses
                // the sidebar auto-open — the inline AgentActionCard / batch card
                // (rendered once at message level after streaming) is the approval
                // surface.
                const isProposal =
                  part.state === 'output-available' &&
                  extractPendingActionId(toolOutput) !== null
                return (
                  <ToolCallRow
                    key={`tool-${index}`}
                    toolCallId={toolCallId}
                    toolName={toolName}
                    state={part.state}
                    detail={getToolDetail(toolName, input)}
                    output={toolOutput}
                    autoOpen={!isProposal}
                  />
                )
              }

              if (isTextUIPart(part)) {
                const webSources =
                  item.kind === 'part' ? item.webSources : undefined
                return (
                  <div key={`text-${index}`}>
                    <TextBlock
                      text={part.text}
                      isStreaming={isActive && index === parts.length - 1}
                      {...(index === lastTextIndex
                        ? { onRevealingChange: setLastTextRevealing }
                        : {})}
                    />
                    {turnSettled && webSources && webSources.length > 0 && (
                      <span className="inline-flex flex-wrap gap-1 mt-1 animate-in fade-in duration-300">
                        {deduplicateWebSources(webSources).map((src, i) => (
                          <CitationPillInline key={`web-${index}-${i}`}>
                            {src.title ?? src.domain}
                          </CitationPillInline>
                        ))}
                      </span>
                    )}
                  </div>
                )
              }

              return null
            })}

          {/* Story 14.22/14.23: inline approval card(s) — rendered once per message
            and only after the turn finishes streaming (avoids the mid-stream
            mount + SWR-fetch re-render that made post-tool streaming choppy).
            Sourced from live tool parts ∪ persisted metadata so the card survives
            a chat exit/reenter. A lone proposal renders the standalone
            single-action card (AC 20); 2+ proposals from one message consolidate
            into a single batch card keyed by chat_message_id (=== message.id per
            ADR-14.22-A). */}
          {turnSettled && pendingApprovalIds.length === 1 && (
            <AgentActionCard
              key={`approval-${pendingApprovalIds[0]}`}
              pendingActionId={pendingApprovalIds[0]!}
            />
          )}
          {turnSettled && pendingApprovalIds.length >= 2 && (
            <AgentActionBatchCard
              key={`batch-${message.id}`}
              chatMessageId={message.id}
            />
          )}

          {turnSettled && sourceMap.size > 0 && (
            <SourcesAccordion
              sourceMap={sourceMap}
              fullText={fullText}
              parts={parts}
            />
          )}

          <div className="flex items-center gap-1 mt-2">
            {showActions && fullText.trim() && turnSettled && (
              <MessageActions messageId={message.id} content={fullText} />
            )}
            {onDelete && turnSettled && (
              <DeleteMessageButton onConfirm={() => onDelete(message.id)} />
            )}
          </div>
        </div>
      </div>
    </CitationSourceProvider>
  )
}

// ---------------------------------------------------------------------------
// ReasoningBlock — Swedish-first thinking-state surface.
//
// Streaming: spinner + rotating Swedish phrase, masking the English reasoning
//   trace that Anthropic's extended thinking emits regardless of conversation
//   language.
// Done: a single static "Tänkte klart" breadcrumb pill that persists in
//   scrollback. The raw reasoning text is intentionally NOT rendered — the
//   action chips below convey what the model actually did, and the Swedish
//   response carries the substance. Auditing of reasoning is a server-side
//   concern (activity log), not a UI surface.
// ---------------------------------------------------------------------------

function ReasoningBlock({
  state,
}: {
  state?: 'streaming' | 'done' | undefined
}) {
  const isThinking = state === 'streaming'
  const phrase = useRotatingThinkingPhrase(isThinking)

  if (isThinking) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
        <span className="font-medium" aria-live="polite">
          {phrase}…
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
      <Brain className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">Tänkte klart</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LiveWorkingStatus — Story 19.15. The single, fixed "working" row that sits
// beside the avatar during an active turn's reasoning/tool phase. It updates in
// place (no ladder): the activity label reflects the most recent in-progress
// step, and a threshold-in elapsed timer proves liveness.
// ---------------------------------------------------------------------------

/** Seconds before the elapsed timer appears (fast turns don't flash a timer). */
const WORKING_TIMER_THRESHOLD_S = 2

function LiveWorkingStatus({
  parts,
  elapsedSeconds,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[]
  elapsedSeconds: number | null
}) {
  const phrase = useRotatingThinkingPhrase(true)

  // Current activity = the most recent in-progress step. A streaming reasoning
  // part reads as "thinking" (rotating Swedish phrase, masking the English
  // trace); a running tool reads with that tool's Swedish label.
  let activity: string | null = null
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (isReasoningUIPart(part) && part.state !== 'done') {
      activity = phrase
      break
    }
    if (
      isToolUIPart(part) &&
      part.state !== 'output-available' &&
      part.state !== 'output-error'
    ) {
      const toolName =
        'toolName' in part ? part.toolName : part.type.replace('tool-', '')
      if (!TOOL_CONFIG[toolName]?.hidden) {
        activity = TOOL_CONFIG[toolName]?.label ?? toolName
        break
      }
    }
  }
  const label = activity ?? phrase

  const timerLabel =
    elapsedSeconds !== null && elapsedSeconds >= WORKING_TIMER_THRESHOLD_S
      ? formatDuration(elapsedSeconds)
      : null

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
      {/* aria-live ONLY on the activity label — the ticking seconds must NOT be
          in a live region (a screen reader must not announce every second). */}
      <span className="font-medium" aria-live="polite">
        {label}…
      </span>
      {timerLabel && (
        <span className="tabular-nums text-muted-foreground/60">
          · {timerLabel}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WorkingAutoOpeners — Story 19.15. Headless: during the live working phase the
// per-step tool chips are suppressed, but write-preview tools (sidebarHint
// 'open') must still auto-open the sidebar. This mounts the same debounced,
// deduped ToolAutoOpener the visible rows would have used.
// ---------------------------------------------------------------------------

function WorkingAutoOpeners({
  parts,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[]
}) {
  const infos = parts
    .filter(isToolUIPart)
    .map((part, i) => extractToolPartInfo(part, i))

  return (
    <>
      {infos.map((info) => {
        if (info.state !== 'output-available') return null
        const output = info.toolOutput
        const meta =
          output && typeof output === 'object'
            ? (output as { _meta?: ToolMeta })._meta
            : undefined
        if (meta?.sidebarHint !== 'open') return null
        return (
          <ToolAutoOpener
            key={`working-auto-${info.toolCallId}`}
            toolCallId={info.toolCallId}
            toolName={info.toolName}
            output={output}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// AgentProgressGroup — Story 19.15. One collapsed "Arbetsförlopp" summary for a
// contiguous run of interleaved reasoning + tool steps. Mirrors the
// CollapsedToolGroup visual language (bg-muted/40 row, chevron, indented
// expanded list) but counts reasoning steps and freezes the turn duration.
// ---------------------------------------------------------------------------

function AgentProgressGroup({
  items,
  durationLabel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: Array<{ part: any; index: number }>
  durationLabel?: string | undefined
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()

  const stepCount = items.length
  const hasTools = items.some((it) => isToolUIPart(it.part))
  // "Tänkte och sökte" when the agent both reasoned and used tools; a
  // reasoning-only multi-step run reads "Tänkte i N steg".
  const summary = hasTools
    ? `Tänkte och sökte i ${stepCount} steg`
    : `Tänkte i ${stepCount} steg`
  const label = durationLabel ? `${summary} · ${durationLabel}` : summary

  return (
    <div className="space-y-0">
      {/* Preserve write-preview sidebar auto-open for any grouped tool. */}
      {items.map((it) => {
        if (!isToolUIPart(it.part)) return null
        const info = extractToolPartInfo(it.part, it.index)
        const output = info.toolOutput
        const meta =
          output && typeof output === 'object'
            ? (output as { _meta?: ToolMeta })._meta
            : undefined
        if (meta?.sidebarHint !== 'open') return null
        return (
          <ToolAutoOpener
            key={`progress-auto-${info.toolCallId}`}
            toolCallId={info.toolCallId}
            toolName={info.toolName}
            output={output}
          />
        )
      })}

      {/* Single cohesive summary row: brain · "Tänkte och sökte i N steg" · chevron */}
      <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors min-w-0">
        <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1 min-w-0 truncate text-left">
          {label}
        </span>
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

      {/* Expanded per-step timeline — reasoning steps + tool rows in order. */}
      {isExpanded && (
        <div
          id={contentId}
          className="ml-4 pl-3 border-l border-border/50 space-y-0 mt-0.5 py-1 animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          {items.map((it) => {
            if (isReasoningUIPart(it.part)) {
              return (
                <div
                  key={`step-reasoning-${it.index}`}
                  className="flex items-center gap-1.5 py-0.5 px-1.5 text-xs text-muted-foreground"
                >
                  <Brain className="h-3 w-3 shrink-0" />
                  <span className="font-medium">Tänkte</span>
                </div>
              )
            }
            const info = extractToolPartInfo(it.part, it.index)
            return (
              <ToolCallRow
                key={`step-tool-${info.toolCallId}`}
                toolCallId={info.toolCallId}
                toolName={info.toolName}
                state={info.state}
                detail={getToolDetail(info.toolName, info.input)}
                output={info.toolOutput}
                autoOpen={false}
                compact={true}
              />
            )
          })}
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
    // Clickability is allowlist-driven (only tools with a curated detail view).
    // Keeps the grouped summary consistent with the standalone row and never
    // exposes the generic JSON dump for internal tools.
    return isToolResultExpandable(run.toolName)
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

  // Keep the collapsed summary to a single line: show the first few runs as
  // chips and fold the rest into a "+N till" affordance that expands the group.
  // The chevron still reveals every per-call row, so nothing is lost.
  const MAX_VISIBLE_RUNS = 4
  const visibleRuns = runs.slice(0, MAX_VISIBLE_RUNS)
  const hiddenRunCount = runs
    .slice(MAX_VISIBLE_RUNS)
    .reduce((n, r) => n + r.count, 0)

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

        <div className="flex items-center gap-x-1.5 flex-1 min-w-0 text-left">
          <div className="flex items-center gap-x-1.5 flex-1 min-w-0 flex-nowrap overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]">
            {visibleRuns.flatMap((run, i) => {
              const cfg = TOOL_CONFIG[run.toolName]
              // Story 19.4 follow-up (1a): a run of proposal tool calls uses the
              // proposal label ("Föreslog kravpunkt") rather than the done label.
              const isProposalRun = run.outputs.some(
                (o) => extractPendingActionId(o) !== null
              )
              const baseLabel =
                (isProposalRun && cfg?.proposalLabel) ||
                cfg?.doneLabel ||
                run.toolName
              const label = baseLabel + (run.count > 1 ? ` (${run.count})` : '')
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
                    className="text-muted-foreground/40 text-xs select-none shrink-0"
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
                      'text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-sm -mx-0.5 px-0.5 shrink-0 whitespace-nowrap',
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
                    className="text-xs font-medium text-muted-foreground shrink-0 whitespace-nowrap"
                  >
                    {label}
                  </span>
                )
              }
              return nodes
            })}
          </div>

          {hiddenRunCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors rounded-sm px-0.5"
            >
              +{hiddenRunCount} till
            </button>
          )}
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
 * - everything else → 'tool-result'
 *
 * Story 14.23: the generic write-action sidebar route was removed — write
 * tools now render inline approval cards (AgentActionCard / batch card), not a
 * sidebar preview. save_assessment keeps its dedicated 'assessment' detail.
 */
function buildDetailItem(
  toolCallId: string,
  toolName: string,
  output: unknown
): ChatDetailItem {
  const isAssessmentPreview =
    toolName === 'save_assessment' &&
    output &&
    typeof output === 'object' &&
    'confirmation_required' in output &&
    (output as { confirmation_required: boolean }).confirmation_required

  if (isAssessmentPreview) {
    // save_assessment returns its data under `preview` (not the generic
    // WriteToolResponse `params`). Pull the recommendation through so the form
    // opens pre-filled with the agent's proposal.
    const preview = getAssessmentPreview(output)
    const assessmentData: AssessmentDetailData = {
      changeEventId: preview?.changeEventId ?? '',
      lawListItemId: preview?.lawListItemId ?? '',
      amendmentSfs: '',
      changeType: '',
      affectedSections: [],
      effectiveDate: null,
      existingAssessment: null,
      recommendation: extractRecommendation(preview),
      documentTitle: '',
      documentNumber: '',
    }
    return {
      type: 'assessment' as const,
      id: toolCallId,
      data: assessmentData,
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
  // Allowlist-driven: only tools with a curated detail view are clickable.
  // Everything else renders as a non-clickable status line so the generic JSON
  // dump (internal data / skill prompts) is never reachable.
  const isClickable =
    isDone &&
    output !== undefined &&
    chatDetail !== null &&
    isToolResultExpandable(toolName)

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

  // Story 14.22: a completed create_task whose output is a proposal (carries a
  // pendingActionId) reads "Föreslog uppgift", not "Skapade uppgift" — nothing
  // was created until the user approves the card. The bare doneLabel still
  // applies to the legacy execute:true path (actual creation, no pendingActionId).
  const isProposalOutput = isDone && extractPendingActionId(output) !== null
  const label = isError
    ? `${config?.label ?? toolName} misslyckades`
    : isDone
      ? isProposalOutput && config?.proposalLabel
        ? config.proposalLabel
        : (config?.doneLabel ?? toolName)
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
            'text-xs shrink-0 whitespace-nowrap',
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
          <span className="text-xs text-muted-foreground/60 truncate min-w-0 flex-1">
            — {detail}
          </span>
        )}
      </>
    )
  }

  const rowClasses = cn(
    'flex items-center gap-1.5 rounded-md w-full min-w-0 overflow-hidden transition-colors',
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
    <div className="space-y-1 ml-px min-w-0">
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
      {isDone &&
        sidebarHint === 'suggest' &&
        isToolResultExpandable(toolName) &&
        chatDetail &&
        !compact && (
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
  onRevealingChange,
}: {
  text: string
  isStreaming: boolean
  /** Reports whether the buffer is still revealing (streaming or draining). */
  onRevealingChange?: (_revealing: boolean) => void
}) {
  // Re-pace the stream client-side so the renderer never receives many tokens
  // per commit — that's what keeps the fade a single top-to-bottom front instead
  // of mounting (and animating) two paragraphs at once. See useSmoothStream.
  const displayed = useSmoothStream(text, isStreaming)

  // "revealing" stays true after the stream ends until the buffer finishes
  // draining its backlog. "animating" keeps the fade + single-block on for that
  // whole window (not just while isStreaming) so the drained tail still fades in
  // monotonically; once fully revealed we drop to plain static rendering.
  const revealing = displayed.length < text.length
  const animating = isStreaming || revealing

  useEffect(() => {
    onRevealingChange?.(revealing)
  }, [revealing, onRevealingChange])

  // Always wire the citation plugin + components — the plugin early-bails on
  // citation-free text (see rehype-citation-pills.ts), so always-on is free.
  // Conditionally swapping the plugin/components array based on text content
  // caused Streamdown's cached AST to keep raw `[Källa: ...]` text after the
  // marker appeared mid-stream; switching to a stable reference fixes the
  // "needs hard refresh for the pill to render" symptom on localhost.
  return (
    <div className={cn(PROSE_CLASSES, 'chat-markdown')}>
      <Streamdown
        mode={animating ? 'streaming' : 'static'}
        isAnimating={animating}
        // Single block while animating → one global, monotonic fade pass (no two
        // paragraphs animating on independent clocks). See SINGLE_BLOCK.
        {...(animating ? { parseMarkdownIntoBlocksFn: SINGLE_BLOCK } : {})}
        // stagger: 0 is essential here — useSmoothStream feeds one new word per
        // step, so only that word should fade (delay 0). A non-zero stagger
        // would queue delays and leave just-revealed words stuck at opacity 0.
        // Short duration keeps the fading wave to a few words. Suppressed when
        // mode="static".
        animated={{
          animation: 'fadeIn',
          sep: 'word',
          duration: 220,
          easing: 'ease-out',
          stagger: 0,
        }}
        plugins={streamdownPlugins}
        rehypePlugins={citationRehypePlugins}
        components={citationComponents}
        className="streamdown"
      >
        {displayed}
      </Streamdown>
    </div>
  )
}

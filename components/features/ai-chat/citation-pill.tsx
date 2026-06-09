'use client'

/**
 * Inline citation pill with hover card.
 * Used as a Streamdown `components` mapping for <cite> elements
 * created by the rehype-citation-pills plugin.
 *
 * Composes AI SDK Elements InlineCitation sub-components with a
 * controlled HoverCard + explicit mouse events to work reliably
 * inside Streamdown's toJsxRuntime rendering context.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink, FileText, Globe } from 'lucide-react'
import { track } from '@vercel/analytics'
import { useCitationSources } from '@/lib/ai/citation-context'
import { useChatDetailSafe } from '@/lib/ai/chat-detail-context'
import {
  resolveSource,
  formatChunkPath,
  parseCitationLabel,
  anchorIdFromPath,
  getDocBrowsePath,
} from '@/lib/ai/citations'
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationSource,
} from '@/components/ui/inline-citation'

const OPEN_DELAY = 200
const CLOSE_DELAY = 150

/**
 * CitationPillInline — receives children text from <cite> elements.
 * Resolves source info from CitationSourceContext.
 *
 * Lookup strategy:
 *   1. Try full label (e.g. "SFS 1977:1160, Kap 3, 2a §") — chunk-specific
 *   2. Fall back to document number (e.g. "SFS 1977:1160") — document-level
 *
 * Uses controlled HoverCard state + onMouseEnter/onMouseLeave instead
 * of Radix's built-in onPointerEnter/onPointerLeave, which don't fire
 * reliably when components are rendered via hast-util-to-jsx-runtime.
 */
export function CitationPillInline({
  children,
}: {
  children?: React.ReactNode
}) {
  const sourceMap = useCitationSources()
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Clean up timeout on unmount
  useEffect(() => () => clearTimeout(timeout.current), [])

  const handleEnter = useCallback(() => {
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setOpen(true), OPEN_DELAY)
  }, [])

  const handleLeave = useCallback(() => {
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [])

  // Extract label text from children
  const label =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
        : ''

  // All hooks must be called before any early return (rules-of-hooks)
  const chatDetail = useChatDetailSafe()
  const pillRef = useRef<HTMLElement | null>(null)

  // Resolve source: try chunk path match first, then document number
  const source = label ? resolveSource(label, sourceMap) : null

  // Web sources show domain as pill label (like ChatGPT); DB sources show the citation label
  const isWebResolved = !!source?.url && !source.slug
  const webPillDomain =
    isWebResolved && source.url
      ? (() => {
          try {
            return new URL(source.url).hostname.replace(/^www\./, '')
          } catch {
            return null
          }
        })()
      : null
  // Workspace document sources carry a documentId so the pill can offer a
  // "Öppna styrdokument" navigation CTA. Detect once and reuse below.
  const workspaceDocId = source?.workspaceDocumentId ?? null
  const isWorkspaceDocResolved = !!workspaceDocId

  const displayLabel = (() => {
    if (!label) return ''
    const raw = webPillDomain ?? label
    return raw.length > 35 ? raw.slice(0, 33) + '\u2026' : raw
  })()

  // Parse the label to extract section info even when source falls back to document-level
  const parsed = label ? parseCitationLabel(label) : null
  const resolvedPath = source?.path ?? parsed?.path ?? null
  const resolvedAnchor =
    source?.anchorId ?? (parsed?.path ? anchorIdFromPath(parsed.path) : null)
  const isChunkResolved = !!source?.path

  const citationId = source
    ? `citation-${source.documentNumber}-${resolvedAnchor ?? 'doc'}`
    : ''
  const isActive =
    chatDetail?.activeDetail?.type === 'citation' &&
    chatDetail.activeDetail.id === citationId

  const handleClick = useCallback(() => {
    if (!source) return

    // Web sources: open URL directly in new tab (no sidebar)
    if (isWebResolved && source.url) {
      track('web_citation_clicked', {
        domain: webPillDomain ?? '',
        url: source.url,
      })
      window.open(source.url, '_blank', 'noopener,noreferrer')
      return
    }

    // DB sources: open sidebar detail
    if (!chatDetail) return
    chatDetail.openDetail(
      {
        type: 'citation' as const,
        id: citationId,
        data: {
          title: source.title || '',
          snippet: isChunkResolved ? source.snippet || '' : '',
          documentNumber: source.documentNumber || '',
          slug: source.slug || '',
          ...(resolvedAnchor ? { anchorId: resolvedAnchor } : {}),
          ...(resolvedPath
            ? { path: formatChunkPath(resolvedPath) ?? resolvedPath }
            : {}),
        },
      },
      pillRef.current ?? undefined
    )
  }, [
    chatDetail,
    citationId,
    source,
    isWebResolved,
    webPillDomain,
    isChunkResolved,
    resolvedAnchor,
    resolvedPath,
  ])

  const triggerCallbackRef = useCallback((node: HTMLElement | null) => {
    pillRef.current = node
  }, [])

  if (!label) return null

  // Unresolved source: plain muted pill without hover card
  if (!source) {
    return (
      <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-medium leading-none rounded-full cursor-default select-none bg-muted text-muted-foreground border border-border/40">
        {displayLabel}
      </span>
    )
  }

  // Reuse early detection for web vs DB source
  const isWebSource = isWebResolved

  // Build link with optional section anchor (DB sources only)
  const href =
    !isWebSource && source.slug
      ? `${getDocBrowsePath(source.documentNumber)}/${source.slug}${source.anchorId ? `#${source.anchorId}` : ''}`
      : null

  // Domain for web sources (reuse from pill label computation)
  const webDomain = webPillDomain

  // Chunk-level source has path — show its snippet.
  const isChunkLevel = !!source.path
  const description = isChunkLevel ? source.snippet : null

  return (
    <InlineCitation>
      <InlineCitationCard open={open}>
        <InlineCitationCardTrigger
          ref={triggerCallbackRef}
          label={displayLabel}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={handleClick}
          className={isActive ? 'ring-2 ring-primary bg-primary/10' : undefined}
          {...(isWebSource
            ? { icon: <Globe className="h-3 w-3" /> }
            : isWorkspaceDocResolved
              ? { icon: <FileText className="h-3 w-3" /> }
              : {})}
        />
        <InlineCitationCardBody
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <InlineCitationSource
            {...(source.title ? { title: source.title } : {})}
            {...(description ? { description } : {})}
          />
          {isWebSource && webDomain && (
            <p className="text-[11px] text-muted-foreground">{webDomain}</p>
          )}
          {!isWebSource && !isWorkspaceDocResolved && source.documentNumber && (
            <p className="text-[11px] text-muted-foreground">
              {source.documentNumber}
            </p>
          )}
          {href && (
            <Link
              href={href}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2"
              onClick={() => {
                track('citation_clicked', {
                  documentNumber: source.documentNumber,
                  ...(source.anchorId ? { anchorId: source.anchorId } : {}),
                })
              }}
            >
              Visa i lagläsaren
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {isWorkspaceDocResolved && workspaceDocId && (
            <Link
              href={`/workspace/styrdokument/${workspaceDocId}/edit`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2"
              onClick={() => {
                track('workspace_citation_clicked', {
                  workspaceDocumentId: workspaceDocId,
                })
              }}
            >
              Öppna styrdokument
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
          {isWebSource && source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2"
              onClick={() => {
                track('web_citation_clicked', {
                  domain: webDomain ?? '',
                  url: source.url ?? '',
                })
              }}
            >
              Besök källa
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  )
}

// Re-export for backwards compat
export { CitationPillInline as CitationPill }

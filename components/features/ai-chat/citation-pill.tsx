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
import { ExternalLink } from 'lucide-react'
import { track } from '@vercel/analytics'
import { useCitationSources } from '@/lib/ai/citation-context'
import { resolveSource } from '@/lib/ai/citations'
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

  if (!label) return null

  const displayLabel = label.length > 35 ? label.slice(0, 33) + '\u2026' : label

  // Resolve source: try chunk path match first, then document number
  const source = resolveSource(label, sourceMap)

  // Unresolved source: plain muted pill without hover card
  if (!source) {
    return (
      <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-medium leading-none rounded-full cursor-default select-none bg-muted text-muted-foreground border border-border/40">
        {displayLabel}
      </span>
    )
  }

  // Build link with optional section anchor
  const href = source.slug
    ? `/lagar/${source.slug}${source.anchorId ? `#${source.anchorId}` : ''}`
    : null

  // Chunk-level source has path — show its snippet.
  // Document-level fallback (no path) — don't show the generic summary as if it's section text.
  const isChunkLevel = !!source.path
  const description = isChunkLevel ? source.snippet : null

  return (
    <InlineCitation>
      <InlineCitationCard open={open}>
        <InlineCitationCardTrigger
          label={displayLabel}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        />
        <InlineCitationCardBody
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <InlineCitationSource
            {...(source.title ? { title: source.title } : {})}
            {...(description ? { description } : {})}
          />
          {source.documentNumber && (
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
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  )
}

// Re-export for backwards compat
export { CitationPillInline as CitationPill }

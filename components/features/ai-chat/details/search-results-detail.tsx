'use client'

import Link from 'next/link'
import { FileText, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface SearchResult {
  contextualHeader?: string
  documentNumber?: string
  slug?: string
  relevanceScore?: number
  snippet?: string
  path?: string
}

interface DocumentGroup {
  documentNumber: string
  slug: string | null
  title: string
  results: SearchResult[]
}

interface SearchResultsDetailProps {
  data: unknown
}

/**
 * Unwrap one or more ToolResponse payloads into a flat SearchResult[].
 * Accepts a single response or an array of responses (merged group).
 */
function extractResults(data: unknown): SearchResult[] {
  if (!data || typeof data !== 'object') return []

  // Array of ToolResponse payloads (merged from SearchToolGroup)
  if (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === 'object' &&
    data[0] !== null &&
    'data' in data[0]
  ) {
    return data.flatMap((item) => {
      const payload = (item as { data: unknown }).data
      return Array.isArray(payload) ? payload : []
    })
  }

  // Single ToolResponse shape: { data: T[], _meta: {...} }
  if ('data' in data) {
    const payload = (data as { data: unknown }).data
    return Array.isArray(payload) ? payload : []
  }

  // Raw array
  if (Array.isArray(data)) return data

  return []
}

/**
 * Deduplicate results by documentNumber + path, keeping first occurrence
 * (which has the highest relevance when results are pre-sorted).
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = `${r.documentNumber ?? ''}::${r.path ?? ''}::${r.snippet?.slice(0, 80) ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Group results by parent document (documentNumber).
 */
function groupByDocument(results: SearchResult[]): DocumentGroup[] {
  const map = new Map<string, DocumentGroup>()

  for (const r of results) {
    const docKey = r.documentNumber || 'unknown'
    let group = map.get(docKey)
    if (!group) {
      // Derive a short title from contextualHeader (first segment before ">")
      const headerTitle = r.contextualHeader?.split('>')[0]?.trim()
      group = {
        documentNumber: r.documentNumber || 'Okänt dokument',
        slug: r.slug || null,
        title: headerTitle || r.documentNumber || 'Okänt dokument',
        results: [],
      }
      map.set(docKey, group)
    }
    group.results.push(r)
  }

  return Array.from(map.values())
}

/**
 * Specialized detail view for search_laws tool results.
 * Deduplicates and groups results by parent document.
 */
export function SearchResultsDetail({ data }: SearchResultsDetailProps) {
  const raw = extractResults(data)
  const deduped = deduplicateResults(raw)
  const groups = groupByDocument(deduped)

  if (deduped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Inga resultat hittades.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {deduped.length} resultat i {groups.length}{' '}
        {groups.length === 1 ? 'dokument' : 'dokument'}
      </p>
      {groups.map((group) => (
        <DocumentGroupCard
          key={group.documentNumber}
          group={group}
          defaultOpen={groups.length <= 3}
        />
      ))}
    </div>
  )
}

function DocumentGroupCard({
  group,
  defaultOpen,
}: {
  group: DocumentGroup
  defaultOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const href = group.slug ? `/lagar/${group.slug}` : null

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Document header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">
            {group.title}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {group.documentNumber} &middot; {group.results.length}{' '}
            {group.results.length === 1 ? 'avsnitt' : 'avsnitt'}
          </span>
        </div>
      </button>

      {/* Sections within document */}
      {isOpen && (
        <div className="border-t border-border/60">
          {group.results.map((result, i) => (
            <SearchResultCard key={i} result={result} />
          ))}
          {href && (
            <div className="px-3 py-2 border-t border-border/40">
              <Link
                href={href}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Visa fullständigt dokument
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  // Extract the section-level part from the contextualHeader (after the first ">")
  const sectionLabel = result.contextualHeader?.includes('>')
    ? result.contextualHeader.split('>').slice(1).join('>').trim()
    : result.contextualHeader

  return (
    <div className="px-3 py-2.5 space-y-1 border-b border-border/30 last:border-b-0">
      {sectionLabel && (
        <p className="text-xs font-medium text-foreground/80">{sectionLabel}</p>
      )}

      {result.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {result.snippet}
        </p>
      )}
    </div>
  )
}

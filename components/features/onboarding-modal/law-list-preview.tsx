'use client'

/**
 * Story 25.4 v0.6 (Epic 25, B.4 polish round): right-column preview of the
 * user's freshly-generated default LawList for <DoneGenerateStep>.
 *
 * Self-fetches via SWR — keeps <FirstRunModal>'s props stable so the parent
 * test suite stays untouched. Mirrors the prototype at
 * _prototypes/onboarding-done-generate.html (right column).
 *
 * Three render states from one SWR fetch:
 *   - Loading (initial): skeleton toolbar + 4 skeleton group rows
 *   - Empty (groups[].length === 0 or listId === null — DB write-lag after
 *     status='completed' flips but items still mid-write): muted
 *     "Förbereder förhandsvisning…" line + SWR retry every 2s
 *   - Error (network/query failure): graceful empty card with neutral
 *     "Förhandsvisningen är inte tillgänglig just nu". Parent CTA still works.
 *
 * Group expansion: first group by position with itemCount > 0 (LLM's
 * editorial order — same as /laglistor's natural display).
 */

import useSWR from 'swr'
import { ChevronDown, ChevronRight, Filter, Plus, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { LawListPreviewResponse } from '@/app/api/workspace/law-list-preview/route'

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`Preview fetch failed: ${res.status}`)
    }
    return res.json() as Promise<LawListPreviewResponse>
  })

/**
 * Strip whitespace + cap to 110 chars + ellipsis. businessContext from the
 * LLM may contain newlines and is unbounded; keep preview rows compact.
 *
 * Truncates at the last word-boundary within the cap to avoid ugly mid-word
 * cuts like "Gru…" or "alla…". Falls back to a hard cut only if no
 * whitespace exists in the last ~20 chars (rare for prose).
 */
function truncateBusinessContext(text: string | null): string | null {
  if (!text) return null
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= 110) return collapsed
  const cut = collapsed.slice(0, 110)
  const lastSpace = cut.lastIndexOf(' ')
  // Use word-boundary if there's whitespace in the last 20 chars; otherwise
  // hard-cut (defensive — handles edge cases like one giant token).
  if (lastSpace > 90) {
    return `${cut.slice(0, lastSpace).trimEnd()}…`
  }
  return `${cut.trimEnd()}…`
}

/**
 * Max group rows to render in the preview (1 expanded + 4 collapsed). Keeps
 * the modal height bounded — generations with 10+ groups would otherwise
 * push the done-generate surface past max-h-[90vh]. Remaining groups are
 * indicated by the footer hint ("+N områden till på /laglistor").
 */
const MAX_PREVIEW_GROUPS = 5

interface LawListPreviewProps {
  className?: string
}

export function LawListPreview({ className }: LawListPreviewProps) {
  const { data, error, isLoading } = useSWR<LawListPreviewResponse>(
    '/api/workspace/law-list-preview',
    fetcher,
    {
      // Retry every 2s while groups[] is still empty (DB write-lag handling).
      // Stop polling once groups exist or on error.
      refreshInterval: (latest) =>
        latest && latest.groups.length === 0 ? 2000 : 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 3,
    }
  )

  // Error state — graceful empty card, parent CTAs unaffected
  if (error) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border bg-background',
          className
        )}
      >
        <div className="flex items-center justify-center px-3 py-12">
          <p className="text-[12.5px] text-muted-foreground">
            Förhandsvisningen är inte tillgänglig just nu.
          </p>
        </div>
      </div>
    )
  }

  // Loading state — skeleton placeholder
  if (isLoading || !data) {
    return <PreviewSkeleton className={className} />
  }

  // Empty state — list exists but no items yet (DB write-lag)
  if (data.groups.length === 0 || data.listId === null) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border bg-background',
          className
        )}
      >
        <PreviewToolbar
          totalItems={data.totalItems}
          areaCount={data.groups.length}
        />
        <div className="flex items-center justify-center px-3 py-12">
          <p className="text-[12.5px] text-muted-foreground">
            Förbereder förhandsvisning…
          </p>
        </div>
      </div>
    )
  }

  const expandedGroupId = data.expandedGroup?.id ?? null
  const expandedGroupName =
    data.groups.find((g) => g.id === expandedGroupId)?.name ?? null

  // Cap the visible group count so the preview doesn't push the modal past
  // max-h-[90vh] on generations with many groups. Expanded group counts as 1
  // toward the cap.
  const collapsedGroups = data.groups.filter((g) => g.id !== expandedGroupId)
  const maxCollapsedVisible = expandedGroupId
    ? MAX_PREVIEW_GROUPS - 1
    : MAX_PREVIEW_GROUPS
  const visibleCollapsed = collapsedGroups.slice(0, maxCollapsedVisible)
  const hiddenCount = collapsedGroups.length - visibleCollapsed.length

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-background',
        className
      )}
    >
      <PreviewToolbar
        totalItems={data.totalItems}
        areaCount={data.groups.length}
      />

      {/* Expanded group header + its first 3 items */}
      {expandedGroupId && expandedGroupName && (
        <>
          <GroupHeader
            name={expandedGroupName}
            itemCount={
              data.groups.find((g) => g.id === expandedGroupId)?.itemCount ?? 0
            }
            expanded
          />
          {data.expandedGroup?.items.map((item) => (
            <ItemRow
              key={item.id}
              title={item.title}
              businessContext={truncateBusinessContext(item.businessContext)}
            />
          ))}
        </>
      )}

      {/* Collapsed group headers (capped at MAX_PREVIEW_GROUPS total) */}
      {visibleCollapsed.map((g, i) => (
        <GroupHeader
          key={g.id}
          name={g.name}
          itemCount={g.itemCount}
          expanded={false}
          // Fade the last visible collapsed row to hint at content below
          // when there are more groups hidden.
          fade={hiddenCount > 0 && i === visibleCollapsed.length - 1}
        />
      ))}

      {/* Footer hint — only renders when groups are actually truncated */}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] text-muted-foreground/70">
          <ChevronDown className="h-3 w-3" aria-hidden="true" />+{hiddenCount}{' '}
          {hiddenCount === 1 ? 'område till' : 'områden till'}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Subparts
// -----------------------------------------------------------------------------

function PreviewToolbar({
  totalItems,
  areaCount,
}: {
  totalItems: number
  areaCount: number
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
      <div className="flex w-44 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-muted-foreground">
        <Search className="h-3 w-3" aria-hidden="true" />
        Sök i laglistan…
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tone-info-soft-bg))] px-2 py-0.5 text-[11.5px] font-medium text-[hsl(var(--tone-info-soft-fg))]">
        {totalItems} regelverk
      </span>
      {areaCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
          {areaCount} {areaCount === 1 ? 'område' : 'områden'}
        </span>
      )}
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-muted-foreground"
        aria-disabled="true"
      >
        <Filter className="h-3 w-3" aria-hidden="true" />
        Filter
      </button>
    </div>
  )
}

function GroupHeader({
  name,
  itemCount,
  expanded,
  fade = false,
}: {
  name: string
  itemCount: number
  expanded: boolean
  fade?: boolean
}) {
  const Icon = expanded ? ChevronDown : ChevronRight
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-border bg-section-warm/60 px-3 py-2',
        // `fade` softens the last visible collapsed row when more groups are
        // hidden — gives a visual "there's more below" hint without breaking
        // layout.
        fade && 'opacity-50'
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-safiro text-[13px]">{name}</span>
      <span className="text-[11.5px] text-muted-foreground">
        · {itemCount} regelverk
      </span>
    </div>
  )
}

function ItemRow({
  title,
  businessContext,
}: {
  title: string
  businessContext: string | null
}) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{title}</div>
          {businessContext && (
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {businessContext}
            </div>
          )}
        </div>
        <span
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-muted text-[9.5px] font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          <Plus className="h-3 w-3" />
        </span>
        <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          Ej granskad
        </span>
      </div>
    </div>
  )
}

function PreviewSkeleton({ className }: { className?: string | undefined }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-background',
        className
      )}
      data-testid="law-list-preview-skeleton"
    >
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="h-6 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        <div className="ml-auto h-6 w-16 animate-pulse rounded-md bg-muted" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-border bg-section-warm/60 px-3 py-2"
        >
          <div className="h-3.5 w-3.5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

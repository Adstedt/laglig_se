'use client'

/**
 * Story 21.5 — Items tab content for /laglistor/kontroller/[cycleId].
 * Pure presentation + local interaction. The parent (CycleDetailPage)
 * owns SWR state + mutation callbacks; this component consumes rows +
 * handlers via props so the header (also rendered by the parent) can
 * share the same data without going through the SWR cache again.
 */

import { useEffect, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  ItemBedomningSelect,
  ItemMotiveringEditor,
  ItemSignOffButton,
} from '@/components/features/compliance-audit/item-bedomning-editor'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import { CycleItemRowDrawer } from './cycle-item-row-drawer'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import type { EfterlevnadsBedomning } from '@prisma/client'

// Mirror compliance-detail-table.tsx conventions so behaviour is predictable.
const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 72
const OVERSCAN_COUNT = 5

interface CycleItemsTabProps {
  items: CycleItemRow[]
  readOnly: boolean
  highlightedRowId: string | null
  onBedomningChange: (
    _row: CycleItemRow,
    _next: EfterlevnadsBedomning | null
  ) => Promise<void>
  onMotiveringChange: (
    _row: CycleItemRow,
    _next: string | null
  ) => Promise<void>
  onSign: (_row: CycleItemRow) => Promise<void>
  onUnsign: (_row: CycleItemRow) => Promise<void>
  // Story 21.7: threaded through to the row drawer for the per-item findings
  // affordance (AC 13). The drawer reads from this shared `findings` array
  // and forwards any edits back to `onFindingMutation` so the page-level SWR
  // cache stays the single source of truth.
  cycleId: string
  findings: FindingRow[]
  onFindingMutation: (_finding: FindingRow) => void
}

export function CycleItemsTab({
  items,
  readOnly,
  highlightedRowId,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  cycleId,
  findings,
  onFindingMutation,
}: CycleItemsTabProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const shouldVirtualise = items.length > VIRTUALIZATION_THRESHOLD

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  // AC 9 keyboard: Escape collapses the currently-expanded drawer. Enter/Space
  // on the chevron button works natively via <button>'s default handling.
  // Attached at document level so the root wrapper can remain a plain <div>
  // (no static-element-interactions a11y violation).
  useEffect(() => {
    if (expandedRowId === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedRowId(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [expandedRowId])

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
        Kontrollen har inga poster.
      </div>
    )
  }

  return (
    // Brand wrapper — matches /tasks, /workspace/styrdokument, and
    // Mina listor's compliance-detail-table. overflow-x-auto for
    // responsive horizontal scroll on narrow viewports.
    <div className="rounded-md border overflow-x-auto">
      <TableHeader />
      {shouldVirtualise ? (
        <VirtualisedBody
          items={items}
          virtualizer={virtualizer}
          scrollRef={scrollRef}
          expandedRowId={expandedRowId}
          setExpandedRowId={setExpandedRowId}
          highlightedRowId={highlightedRowId}
          readOnly={readOnly}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          cycleId={cycleId}
          findings={findings}
          onFindingMutation={onFindingMutation}
        />
      ) : (
        <PlainBody
          items={items}
          expandedRowId={expandedRowId}
          setExpandedRowId={setExpandedRowId}
          highlightedRowId={highlightedRowId}
          readOnly={readOnly}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          cycleId={cycleId}
          findings={findings}
          onFindingMutation={onFindingMutation}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

// Column sizing — cell padding matches shadcn <TableHead>/<TableCell> default
// (px-4, align-middle). Header gets h-12 per shadcn convention; body rows size
// to their content with py-3 vertical breathing room.
const COLUMN_CLASS = {
  lag: 'min-w-[240px] flex-[2_0_0%] px-4',
  nuvarande: 'w-36 px-4',
  bedomning: 'w-40 px-4',
  motivering: 'min-w-[200px] flex-[3_0_0%] px-4',
  ansvarig: 'w-40 px-4',
  signerad: 'w-48 px-4',
  chevron: 'w-10 px-2',
} as const

function TableHeader() {
  // Matches shadcn <TableHeader> + <TableHead> styling used across
  // /laglistor, /uppgifter, /styrdokument: no background tint, h-12,
  // font-medium muted-foreground, sentence case, border-b separator.
  return (
    <div
      role="rowheader"
      className="flex h-12 items-center border-b text-sm font-medium text-muted-foreground"
    >
      <div className={COLUMN_CLASS.lag}>Lag</div>
      <div className={COLUMN_CLASS.nuvarande}>Nuvarande status</div>
      <div className={COLUMN_CLASS.bedomning}>Bedömning</div>
      <div className={COLUMN_CLASS.motivering}>Motivering</div>
      <div className={COLUMN_CLASS.ansvarig}>Ansvarig</div>
      <div className={COLUMN_CLASS.signerad}>Signerad</div>
      <div className={COLUMN_CLASS.chevron} aria-hidden="true" />
    </div>
  )
}

interface RowRenderProps {
  row: CycleItemRow
  expanded: boolean
  highlighted: boolean
  onToggleExpand: () => void
  readOnly: boolean
  onBedomningChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  onMotiveringChange: (_next: string | null) => Promise<void>
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
  cycleId: string
  findings: FindingRow[]
  allItems: CycleItemRow[]
  onFindingMutation: (_finding: FindingRow) => void
}

function RowContent({
  row,
  expanded,
  highlighted,
  onToggleExpand,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  cycleId,
  findings,
  allItems,
  onFindingMutation,
}: RowRenderProps) {
  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === row.sourceComplianceStatus
  )

  const canSign =
    !readOnly && row.signedOffAt === null && row.efterlevnadsbedomning !== null
  const canUnsign = !readOnly && row.signedOffAt !== null

  const signDisabledReason = readOnly
    ? 'Kontrollen är förseglad'
    : row.efterlevnadsbedomning === null
      ? 'Ange bedömning innan signering'
      : undefined

  return (
    <div
      role="row"
      data-cycle-item-id={row.id}
      data-testid={`cycle-item-row-${row.id}`}
      className={cn('transition-colors', highlighted && 'ring-2 ring-primary')}
    >
      <div className="flex items-center border-b py-3 transition-colors hover:bg-muted/50">
        <div className={COLUMN_CLASS.lag}>
          <Link
            href="/laglistor"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-1 hover:text-primary"
            title={row.lawTitle}
          >
            <span className="flex-1">
              <span className="font-medium">{row.lawTitle}</span>
              <span className="block text-xs text-muted-foreground">
                {row.lawDocumentNumber}
              </span>
            </span>
            <ExternalLink
              className="mt-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </Link>
        </div>

        <div className={COLUMN_CLASS.nuvarande}>
          {statusOption ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusOption.color,
                statusOption.strikethrough && 'line-through'
              )}
            >
              {statusOption.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        <div className={COLUMN_CLASS.bedomning}>
          <ItemBedomningSelect
            value={row.efterlevnadsbedomning}
            onChange={onBedomningChange}
            readOnly={readOnly}
          />
        </div>

        <div className={COLUMN_CLASS.motivering}>
          <ItemMotiveringEditor
            value={row.motivering}
            onChange={onMotiveringChange}
            readOnly={readOnly}
          />
        </div>

        <div className={COLUMN_CLASS.ansvarig}>
          <span className="text-sm">
            {row.sourceResponsibleUser?.name ?? '—'}
          </span>
        </div>

        <div className={COLUMN_CLASS.signerad}>
          {/* AC 8: in read-only mode, hide the button entirely for unsigned
              items; for signed items, show metadata (no unsign X). */}
          {readOnly && row.signedOffAt === null ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <ItemSignOffButton
              signedOffAt={row.signedOffAt}
              signedOffBy={row.signedOffBy}
              canSign={canSign}
              canUnsign={canUnsign}
              onSign={onSign}
              onUnsign={onUnsign}
              disabledReason={signDisabledReason}
            />
          )}
        </div>

        <div className={COLUMN_CLASS.chevron}>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? 'Dölj detaljer' : 'Visa detaljer'}
            className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {expanded ? (
        <CycleItemRowDrawer
          row={row}
          cycleId={cycleId}
          readOnly={readOnly}
          findings={findings}
          items={allItems}
          onFindingMutation={onFindingMutation}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plain (non-virtualised) body — used when items ≤ 100
// ---------------------------------------------------------------------------

interface BodyProps {
  items: CycleItemRow[]
  expandedRowId: string | null
  setExpandedRowId: (_id: string | null) => void
  highlightedRowId: string | null
  readOnly: boolean
  onBedomningChange: (
    _row: CycleItemRow,
    _next: EfterlevnadsBedomning | null
  ) => Promise<void>
  onMotiveringChange: (
    _row: CycleItemRow,
    _next: string | null
  ) => Promise<void>
  onSign: (_row: CycleItemRow) => Promise<void>
  onUnsign: (_row: CycleItemRow) => Promise<void>
  cycleId: string
  findings: FindingRow[]
  onFindingMutation: (_finding: FindingRow) => void
}

function PlainBody({
  items,
  expandedRowId,
  setExpandedRowId,
  highlightedRowId,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  cycleId,
  findings,
  onFindingMutation,
}: BodyProps) {
  return (
    <div
      role="grid"
      aria-rowcount={items.length}
      data-testid="cycle-items-list"
    >
      {items.map((row) => {
        const expanded = expandedRowId === row.id
        return (
          <RowContent
            key={row.id}
            row={row}
            expanded={expanded}
            highlighted={highlightedRowId === row.id}
            onToggleExpand={() => setExpandedRowId(expanded ? null : row.id)}
            readOnly={readOnly}
            onBedomningChange={(next) => onBedomningChange(row, next)}
            onMotiveringChange={(next) => onMotiveringChange(row, next)}
            onSign={() => onSign(row)}
            onUnsign={() => onUnsign(row)}
            cycleId={cycleId}
            findings={findings}
            allItems={items}
            onFindingMutation={onFindingMutation}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Virtualised body — used when items > 100
// ---------------------------------------------------------------------------

interface VirtualisedBodyProps extends BodyProps {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  scrollRef: RefObject<HTMLDivElement | null>
}

function VirtualisedBody({
  items,
  virtualizer,
  scrollRef,
  expandedRowId,
  setExpandedRowId,
  highlightedRowId,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  cycleId,
  findings,
  onFindingMutation,
}: VirtualisedBodyProps) {
  // Recompute measurements when the expanded row changes — the drawer changes
  // a row's height from ~72px to several hundred px.
  useEffect(() => {
    virtualizer.measure()
  }, [expandedRowId, virtualizer])

  return (
    <div
      ref={scrollRef}
      className="max-h-[calc(100vh-18rem)] overflow-auto"
      role="grid"
      aria-rowcount={items.length}
      data-testid="cycle-items-list-virtualized"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = items[virtualRow.index]
          if (!row) return null
          const expanded = expandedRowId === row.id
          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={(node) => {
                if (node) virtualizer.measureElement(node)
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <RowContent
                row={row}
                expanded={expanded}
                highlighted={highlightedRowId === row.id}
                onToggleExpand={() =>
                  setExpandedRowId(expanded ? null : row.id)
                }
                readOnly={readOnly}
                onBedomningChange={(next) => onBedomningChange(row, next)}
                onMotiveringChange={(next) => onMotiveringChange(row, next)}
                onSign={() => onSign(row)}
                onUnsign={() => onUnsign(row)}
                cycleId={cycleId}
                findings={findings}
                allItems={items}
                onFindingMutation={onFindingMutation}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

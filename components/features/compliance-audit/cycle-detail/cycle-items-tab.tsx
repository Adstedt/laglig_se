'use client'

/**
 * Story 21.5 + Story 21.16 — Items tab content for /laglistor/kontroller/[cycleId].
 *
 * Pure presentation + local interaction. The parent (CycleDetailPage) owns
 * SWR state, mutation callbacks, AND the selected-item state that drives the
 * CycleItemModal. Clicking a row calls `onSelectItem(row.id)` which opens the
 * modal; chevron + expanded-row-drawer pattern was removed in Story 21.16 per
 * UX redesign (replaced by the modal).
 */

import { useRef, type RefObject } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  ItemBedomningSelect,
  ItemMotiveringEditor,
  ItemSignOffButton,
} from '@/components/features/compliance-audit/item-bedomning-editor'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import {
  EfterlevnadsBedomning,
  FindingSeverity,
  FindingType,
} from '@prisma/client'

// Mirror compliance-detail-table.tsx conventions so behaviour is predictable.
const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 72
const OVERSCAN_COUNT = 5

// Story 21.16: max number of finding dots rendered inline per row. Beyond
// this we truncate to "+N" to keep the row compact at high finding counts.
const MAX_INLINE_FINDING_DOTS = 6

interface CycleItemsTabProps {
  items: CycleItemRow[]
  readOnly: boolean
  highlightedRowId: string | null
  /** Story 21.16 — row currently open in the modal. Paints a subtle bar on
   *  the left edge so users remember where they are when the modal closes. */
  selectedItemId: string | null
  /** Story 21.16 — open the CycleItemModal on this row. Parent writes to
   *  state + URL; this component is purely presentational. */
  onSelectItem: (_itemId: string) => void
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
  /** Story 21.7 — findings array (hoisted at the page level). Used for the
   *  inline finding-dot signals under each law row. */
  findings: FindingRow[]
}

export function CycleItemsTab({
  items,
  readOnly,
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
}: CycleItemsTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldVirtualise = items.length > VIRTUALIZATION_THRESHOLD

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
        Kontrollen har inga dokument.
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <TableHeader />
      {shouldVirtualise ? (
        <VirtualisedBody
          items={items}
          virtualizer={virtualizer}
          scrollRef={scrollRef}
          highlightedRowId={highlightedRowId}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          readOnly={readOnly}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          findings={findings}
        />
      ) : (
        <PlainBody
          items={items}
          highlightedRowId={highlightedRowId}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          readOnly={readOnly}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          findings={findings}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

// Story 21.16: chevron column removed. Row becomes pure navigation — clicking
// anywhere outside the inline controls opens the modal.
const COLUMN_CLASS = {
  lag: 'min-w-[240px] flex-[2_0_0%] px-4',
  nuvarande: 'w-36 px-4',
  bedomning: 'w-40 px-4',
  motivering: 'min-w-[200px] flex-[3_0_0%] px-4',
  ansvarig: 'w-40 px-4',
  signerad: 'w-48 px-4',
} as const

function TableHeader() {
  return (
    <div
      role="rowheader"
      className="flex h-12 items-center border-b text-sm font-medium text-muted-foreground"
    >
      <div className={COLUMN_CLASS.lag}>Dokument</div>
      <div className={COLUMN_CLASS.nuvarande}>Nuvarande status</div>
      <div className={COLUMN_CLASS.bedomning}>Bedömning</div>
      <div className={COLUMN_CLASS.motivering}>Motivering</div>
      <div className={COLUMN_CLASS.ansvarig}>Ansvarig</div>
      <div className={COLUMN_CLASS.signerad}>Signerad</div>
    </div>
  )
}

interface RowRenderProps {
  row: CycleItemRow
  highlighted: boolean
  selected: boolean
  onSelect: () => void
  readOnly: boolean
  onBedomningChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  onMotiveringChange: (_next: string | null) => Promise<void>
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
  itemFindings: FindingRow[]
}

function RowContent({
  row,
  highlighted,
  selected,
  onSelect,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  itemFindings,
}: RowRenderProps) {
  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === row.sourceComplianceStatus
  )

  const canSign =
    !readOnly && row.signedOffAt === null && row.efterlevnadsbedomning !== null
  const canUnsign = !readOnly && row.signedOffAt !== null

  const signDisabledReason = readOnly
    ? 'Kontrollen är fastställd'
    : row.efterlevnadsbedomning === null
      ? 'Ange bedömning innan signering'
      : undefined

  return (
    <div
      role="row"
      data-cycle-item-id={row.id}
      data-testid={`cycle-item-row-${row.id}`}
      aria-selected={selected}
      className={cn(
        'transition-colors',
        highlighted && 'ring-2 ring-primary',
        selected && 'bg-muted/40 shadow-[inset_2px_0_0_hsl(var(--primary))]'
      )}
    >
      <div
        className="flex items-center border-b py-3 transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Prevent scrolling on Space
            if (e.target === e.currentTarget) {
              e.preventDefault()
              onSelect()
            }
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Öppna ${row.lawTitle}`}
      >
        <div className={COLUMN_CLASS.lag}>
          <div className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-medium truncate" title={row.lawTitle}>
                  {row.lawTitle}
                </span>
                <Link
                  href="/laglistor"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                  aria-label="Öppna i laglistan (ny flik)"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{row.lawDocumentNumber}</span>
                <FindingDots findings={itemFindings} />
              </div>
            </div>
          </div>
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

        {/* Inline controls — stopPropagation so clicking them doesn't also
            open the modal. */}
        {/* Stop-propagation zone: clicking the inline Bedömning control
            shouldn't bubble to the row-level click-to-open-modal handler. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.bedomning}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ItemBedomningSelect
            value={row.efterlevnadsbedomning}
            onChange={onBedomningChange}
            readOnly={readOnly}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.motivering}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.signerad}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
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
      </div>
    </div>
  )
}

/**
 * Story 21.16: inline row signal for open findings. One dot per open finding
 * (up to MAX_INLINE_FINDING_DOTS), colored by severity:
 *   - red    = AVVIKELSE + MAJOR
 *   - orange = AVVIKELSE + MINOR
 *   - amber  = OBSERVATION
 *   - blue   = FORBATTRING
 * Followed by a count tail. When no open findings exist, renders nothing
 * (keeps the row clean).
 */
function FindingDots({ findings }: { findings: FindingRow[] }) {
  const openFindings = findings.filter((f) => f.closedAt === null)
  if (openFindings.length === 0) return null

  const visible = openFindings.slice(0, MAX_INLINE_FINDING_DOTS)
  const overflow = openFindings.length - visible.length

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {visible.map((f) => (
        <span
          key={f.id}
          className={cn('h-1.5 w-1.5 rounded-full', findingDotColor(f))}
        />
      ))}
      {overflow > 0 ? (
        <span className="ml-1 text-[10px]">+{overflow}</span>
      ) : null}
      <span className="ml-1.5">
        {openFindings.length} {openFindings.length === 1 ? 'öppen' : 'öppna'}
      </span>
    </span>
  )
}

function findingDotColor(f: FindingRow): string {
  if (f.type === FindingType.AVVIKELSE) {
    return f.severity === FindingSeverity.MAJOR ? 'bg-red-500' : 'bg-orange-500'
  }
  if (f.type === FindingType.OBSERVATION) return 'bg-amber-500'
  return 'bg-blue-500'
}

// ---------------------------------------------------------------------------
// Plain (non-virtualised) body — used when items ≤ 100
// ---------------------------------------------------------------------------

interface BodyProps {
  items: CycleItemRow[]
  highlightedRowId: string | null
  selectedItemId: string | null
  onSelectItem: (_itemId: string) => void
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
  findings: FindingRow[]
}

function PlainBody({
  items,
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
}: BodyProps) {
  return (
    <div
      role="grid"
      aria-rowcount={items.length}
      data-testid="cycle-items-list"
    >
      {items.map((row) => {
        const itemFindings = findings.filter(
          (f) => f.lawListItemId === row.lawListItemId
        )
        return (
          <RowContent
            key={row.id}
            row={row}
            highlighted={highlightedRowId === row.id}
            selected={selectedItemId === row.id}
            onSelect={() => onSelectItem(row.id)}
            readOnly={readOnly}
            onBedomningChange={(next) => onBedomningChange(row, next)}
            onMotiveringChange={(next) => onMotiveringChange(row, next)}
            onSign={() => onSign(row)}
            onUnsign={() => onUnsign(row)}
            itemFindings={itemFindings}
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
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  readOnly,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
}: VirtualisedBodyProps) {
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
          const itemFindings = findings.filter(
            (f) => f.lawListItemId === row.lawListItemId
          )
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
                highlighted={highlightedRowId === row.id}
                selected={selectedItemId === row.id}
                onSelect={() => onSelectItem(row.id)}
                readOnly={readOnly}
                onBedomningChange={(next) => onBedomningChange(row, next)}
                onMotiveringChange={(next) => onMotiveringChange(row, next)}
                onSign={() => onSign(row)}
                onUnsign={() => onUnsign(row)}
                itemFindings={itemFindings}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

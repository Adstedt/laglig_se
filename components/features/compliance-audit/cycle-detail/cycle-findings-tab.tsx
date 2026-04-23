'use client'

/**
 * Story 21.7 — Findings tab content for /laglistor/kontroller/[cycleId].
 * Pure presentation + local interaction. The parent (CycleDetailPage) owns
 * the SWR fetch + mutation callbacks; this component consumes `findings` via
 * prop so the per-item row drawer (AC 13) can share the same array without a
 * second SWR subscription.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Plus,
  Eye,
} from 'lucide-react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  closeFinding,
  reopenFinding,
  spawnTaskForFinding,
  type FindingRow,
} from '@/app/actions/compliance-finding'
import {
  FINDING_SEVERITY_LABELS,
  FINDING_TYPE_LABELS,
} from '@/components/features/compliance-audit/finding-copy'
import { FindingEditor } from '@/components/features/compliance-audit/finding-editor'
import { FindingSeverity, FindingType } from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'

const VIRTUALIZATION_THRESHOLD = 50
const ESTIMATED_ROW_HEIGHT = 88
const OVERSCAN_COUNT = 5

type TypeFilter = 'ALL' | FindingType
type SeverityFilter = 'ALL' | FindingSeverity
type StatusFilter = 'all' | 'open' | 'closed'

interface CycleFindingsTabProps {
  cycleId: string
  findings: FindingRow[]
  readOnly: boolean
  items: CycleItemRow[]
  onFindingMutation: (_finding: FindingRow) => void
}

export function CycleFindingsTab({
  cycleId,
  findings,
  readOnly,
  items,
  onFindingMutation,
}: CycleFindingsTabProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<FindingRow | null>(null)

  // Hide severity filter when type filter is not AVVIKELSE.
  useEffect(() => {
    if (typeFilter !== FindingType.AVVIKELSE && severityFilter !== 'ALL') {
      setSeverityFilter('ALL')
    }
  }, [typeFilter, severityFilter])

  // Escape collapses expanded row.
  useEffect(() => {
    if (expandedId === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedId(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [expandedId])

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (typeFilter !== 'ALL' && f.type !== typeFilter) return false
      if (severityFilter !== 'ALL' && f.severity !== severityFilter)
        return false
      if (statusFilter === 'open' && f.closedAt !== null) return false
      if (statusFilter === 'closed' && f.closedAt === null) return false
      return true
    })
  }, [findings, typeFilter, severityFilter, statusFilter])

  const openEditorForCreate = useCallback(() => {
    setEditingFinding(null)
    setEditorOpen(true)
  }, [])

  const openEditorForEdit = useCallback((f: FindingRow) => {
    setEditingFinding(f)
    setEditorOpen(true)
  }, [])

  const handleClose = useCallback(
    async (f: FindingRow) => {
      // No close_reason prompt in this surface — if the gate rejects, the user
      // sees a toast and can still close from the expanded-row "manuell
      // anledning" path (future enhancement — for 21.7 we surface the error).
      const result = await closeFinding({ findingId: f.id })
      if (!result.success || !result.data) {
        toast.error('Kunde inte stänga finding', {
          description: result.error,
        })
        return
      }
      toast.success('Finding stängd')
      onFindingMutation(result.data.finding)
    },
    [onFindingMutation]
  )

  const handleReopen = useCallback(
    async (f: FindingRow) => {
      const result = await reopenFinding(f.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte återöppna finding', {
          description: result.error,
        })
        return
      }
      toast.success('Finding återöppnad')
      onFindingMutation(result.data.finding)
    },
    [onFindingMutation]
  )

  // Epic 21 follow-up: late-add spawn-task path. Any open finding without a
  // linked task can spawn one — matches the prototype decision tree row 4
  // ("Any existing finding, + Skapa åtgärdsuppgift clicked").
  const handleSpawnTask = useCallback(
    async (f: FindingRow) => {
      const result = await spawnTaskForFinding({ findingId: f.id })
      if (!result.success || !result.data) {
        toast.error('Kunde inte skapa åtgärdsuppgift', {
          description: result.error,
        })
        return
      }
      toast.success('Åtgärdsuppgift skapad')
      onFindingMutation(result.data.finding)
    },
    [onFindingMutation]
  )

  const shouldVirtualise = filtered.length > VIRTUALIZATION_THRESHOLD
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  return (
    <div className="space-y-4">
      {readOnly ? (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          Denna kontroll är förseglad. Findings kan endast visas.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
        {!readOnly ? (
          <Button
            type="button"
            onClick={openEditorForCreate}
            data-testid="cycle-findings-add-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Lägg till finding
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
          {findings.length === 0
            ? 'Inga findings registrerade ännu.'
            : 'Inga findings matchar filtret.'}
        </div>
      ) : shouldVirtualise ? (
        <VirtualisedBody
          findings={filtered}
          virtualizer={virtualizer}
          scrollRef={scrollRef}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          readOnly={readOnly}
          onEdit={openEditorForEdit}
          onClose={handleClose}
          onReopen={handleReopen}
          onSpawnTask={handleSpawnTask}
        />
      ) : (
        <PlainBody
          findings={filtered}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          readOnly={readOnly}
          onEdit={openEditorForEdit}
          onClose={handleClose}
          onReopen={handleReopen}
          onSpawnTask={handleSpawnTask}
        />
      )}

      <FindingEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        cycleId={cycleId}
        mode={editingFinding ? 'edit' : 'create'}
        {...(editingFinding ? { finding: editingFinding } : {})}
        items={items}
        onSuccess={onFindingMutation}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

interface FilterChipsProps {
  typeFilter: TypeFilter
  setTypeFilter: (_f: TypeFilter) => void
  severityFilter: SeverityFilter
  setSeverityFilter: (_f: SeverityFilter) => void
  statusFilter: StatusFilter
  setStatusFilter: (_f: StatusFilter) => void
}

function FilterChips({
  typeFilter,
  setTypeFilter,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
}: FilterChipsProps) {
  const typeOptions: Array<{ value: TypeFilter; label: string }> = [
    { value: 'ALL', label: 'Alla' },
    { value: 'AVVIKELSE', label: FINDING_TYPE_LABELS.AVVIKELSE },
    { value: 'OBSERVATION', label: FINDING_TYPE_LABELS.OBSERVATION },
    { value: 'FORBATTRING', label: FINDING_TYPE_LABELS.FORBATTRING },
  ]

  const severityOptions: Array<{ value: SeverityFilter; label: string }> = [
    { value: 'ALL', label: 'Alla allvar' },
    { value: 'MAJOR', label: FINDING_SEVERITY_LABELS.MAJOR },
    { value: 'MINOR', label: FINDING_SEVERITY_LABELS.MINOR },
  ]

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'Alla' },
    { value: 'open', label: 'Öppna' },
    { value: 'closed', label: 'Stängda' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1" role="group" aria-label="Typ">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={typeFilter === opt.value}
            data-testid={`finding-filter-type-${opt.value}`}
            onClick={() => setTypeFilter(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              typeFilter === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-muted-foreground hover:bg-muted'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {typeFilter === FindingType.AVVIKELSE ? (
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Allvarlighetsgrad"
          data-testid="finding-filter-severity-group"
        >
          {severityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={severityFilter === opt.value}
              data-testid={`finding-filter-severity-${opt.value}`}
              onClick={() => setSeverityFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                severityFilter === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="ml-auto flex items-center gap-1"
        role="group"
        aria-label="Status"
      >
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={statusFilter === opt.value}
            data-testid={`finding-filter-status-${opt.value}`}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              statusFilter === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-muted-foreground hover:bg-muted'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

interface BodyProps {
  findings: FindingRow[]
  expandedId: string | null
  setExpandedId: (_id: string | null) => void
  readOnly: boolean
  onEdit: (_f: FindingRow) => void
  onClose: (_f: FindingRow) => Promise<void>
  onReopen: (_f: FindingRow) => Promise<void>
  onSpawnTask: (_f: FindingRow) => Promise<void>
}

function PlainBody({
  findings,
  expandedId,
  setExpandedId,
  readOnly,
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
}: BodyProps) {
  return (
    <div
      role="list"
      className="rounded-md border"
      data-testid="cycle-findings-list"
    >
      {findings.map((f) => {
        const expanded = expandedId === f.id
        return (
          <FindingRowContent
            key={f.id}
            finding={f}
            expanded={expanded}
            onToggleExpand={() => setExpandedId(expanded ? null : f.id)}
            readOnly={readOnly}
            onEdit={() => onEdit(f)}
            onClose={() => onClose(f)}
            onReopen={() => onReopen(f)}
            onSpawnTask={() => onSpawnTask(f)}
          />
        )
      })}
    </div>
  )
}

interface VirtualisedBodyProps extends BodyProps {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  scrollRef: RefObject<HTMLDivElement | null>
}

function VirtualisedBody({
  findings,
  virtualizer,
  scrollRef,
  expandedId,
  setExpandedId,
  readOnly,
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
}: VirtualisedBodyProps) {
  useEffect(() => {
    virtualizer.measure()
  }, [expandedId, virtualizer])

  return (
    <div
      ref={scrollRef}
      className="max-h-[calc(100vh-22rem)] overflow-auto rounded-md border"
      role="list"
      data-testid="virtualized-findings-list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vr) => {
          const f = findings[vr.index]
          if (!f) return null
          const expanded = expandedId === f.id
          return (
            <div
              key={f.id}
              data-index={vr.index}
              ref={(node) => {
                if (node) virtualizer.measureElement(node)
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vr.start}px)`,
              }}
            >
              <FindingRowContent
                finding={f}
                expanded={expanded}
                onToggleExpand={() => setExpandedId(expanded ? null : f.id)}
                readOnly={readOnly}
                onEdit={() => onEdit(f)}
                onClose={() => onClose(f)}
                onReopen={() => onReopen(f)}
                onSpawnTask={() => onSpawnTask(f)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface FindingRowContentProps {
  finding: FindingRow
  expanded: boolean
  onToggleExpand: () => void
  readOnly: boolean
  onEdit: () => void
  onClose: () => Promise<void>
  onReopen: () => Promise<void>
  onSpawnTask: () => Promise<void>
}

function FindingRowContent({
  finding,
  expanded,
  onToggleExpand,
  readOnly,
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
}: FindingRowContentProps) {
  const isClosed = finding.closedAt !== null

  return (
    <div
      role="listitem"
      data-testid={`cycle-finding-row-${finding.id}`}
      className="border-b last:border-b-0"
    >
      <div className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/50">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? 'Dölj detaljer' : 'Visa detaljer'}
          className="mt-1 rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={finding.type} />
            {finding.type === FindingType.AVVIKELSE && finding.severity ? (
              <SeverityBadge severity={finding.severity} />
            ) : null}
            <span className="truncate font-medium">{finding.title}</span>
            <StatusBadge closed={isClosed} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {format(finding.createdAt, 'd MMM yyyy', { locale: sv })}
            </span>
            {finding.lawListItem ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  {finding.lawListItem.title} (
                  {finding.lawListItem.documentNumber})
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!readOnly && !isClosed && finding.correctiveActionTaskId === null ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onSpawnTask}
              title="Skapa en åtgärdsuppgift kopplad till denna finding"
              data-testid={`cycle-finding-spawn-task-${finding.id}`}
            >
              <Plus className="mr-1 h-3 w-3" />
              Skapa åtgärdsuppgift
            </Button>
          ) : null}
          {!readOnly && !isClosed ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onEdit}
                data-testid={`cycle-finding-edit-${finding.id}`}
              >
                Redigera
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onClose}
                data-testid={`cycle-finding-close-${finding.id}`}
              >
                Stäng
              </Button>
            </>
          ) : null}
          {!readOnly && isClosed ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReopen}
              data-testid={`cycle-finding-reopen-${finding.id}`}
            >
              Återöppna
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? <FindingRowDetails finding={finding} /> : null}
    </div>
  )
}

function FindingRowDetails({ finding }: { finding: FindingRow }) {
  return (
    <div className="space-y-3 border-t bg-muted/30 p-4 text-sm">
      <div>
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
          Beskrivning
        </p>
        <p className="whitespace-pre-wrap">{finding.description}</p>
      </div>
      {finding.rootCause ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Grundorsak
          </p>
          <p className="whitespace-pre-wrap">{finding.rootCause}</p>
        </div>
      ) : null}
      {finding.dueDate ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Förfallodatum
          </p>
          <p>{format(finding.dueDate, 'PPP', { locale: sv })}</p>
        </div>
      ) : null}
      {finding.requirement ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Kravpunkt
          </p>
          <p className="whitespace-pre-wrap">{finding.requirement.text}</p>
        </div>
      ) : null}
      {finding.closedAt ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Stängd
          </p>
          <p>
            {format(finding.closedAt, 'PPPp', { locale: sv })}
            {finding.closedBy ? (
              <>
                {' '}
                av{' '}
                <span className="font-medium">
                  {finding.closedBy.name ?? '—'}
                </span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: FindingType }) {
  if (type === FindingType.AVVIKELSE) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700"
      >
        <AlertTriangle className="mr-1 h-3 w-3" />
        {FINDING_TYPE_LABELS.AVVIKELSE}
      </Badge>
    )
  }
  if (type === FindingType.OBSERVATION) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-800"
      >
        <Eye className="mr-1 h-3 w-3" />
        {FINDING_TYPE_LABELS.OBSERVATION}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-blue-200 bg-blue-50 text-blue-700"
    >
      <Lightbulb className="mr-1 h-3 w-3" />
      {FINDING_TYPE_LABELS.FORBATTRING}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-red-300 text-red-800',
        severity === FindingSeverity.MAJOR ? 'bg-red-100' : 'bg-red-50'
      )}
    >
      {FINDING_SEVERITY_LABELS[severity]}
    </Badge>
  )
}

function StatusBadge({ closed }: { closed: boolean }) {
  return closed ? (
    <Badge variant="secondary">Stängd</Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      Öppen
    </Badge>
  )
}

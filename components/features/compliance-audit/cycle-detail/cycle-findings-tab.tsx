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
import { Plus } from 'lucide-react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import {
  closeFinding,
  reopenFinding,
  spawnTaskForFinding,
  type FindingRow,
} from '@/app/actions/compliance-finding'
import {
  FINDING_SEVERITY_LABELS,
  FINDING_TYPE_LABELS,
  getFindingStatus,
} from '@/components/features/compliance-audit/finding-copy'
import { FindingEditor } from '@/components/features/compliance-audit/finding-editor'
import { FindingCard } from '@/components/features/compliance-audit/finding-card'
import { VerifyFindingDialog } from './verify-finding-dialog'
import { ManualCloseFindingDialog } from './manual-close-finding-dialog'
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
  items: CycleItemRow[]
  onFindingMutation: (_finding: FindingRow) => void
  /** Story 21.16 — drill into the Items-tab modal on the finding's parent law
   *  with the finding scrolled into view + highlighted. Parent writes state. */
  onFindingClick?: ((_finding: FindingRow) => void) | undefined
}

// Story 21.27 — `readOnly` + `cycleStatus` props removed. Findings have no
// cycle-status read-only mode after the ARKIVERAD collapse.

export function CycleFindingsTab({
  cycleId,
  findings,
  items,
  onFindingMutation,
  onFindingClick,
}: CycleFindingsTabProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<FindingRow | null>(null)
  // Epic 21 follow-up: explicit verify-step dialog state. null = closed.
  const [verifyFinding, setVerifyFinding] = useState<FindingRow | null>(null)
  const [manualCloseFinding, setManualCloseFinding] =
    useState<FindingRow | null>(null)

  // Hide severity filter when type filter is not AVVIKELSE.
  useEffect(() => {
    if (typeFilter !== FindingType.AVVIKELSE && severityFilter !== 'ALL') {
      setSeverityFilter('ALL')
    }
  }, [typeFilter, severityFilter])

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
      const result = await closeFinding({ findingId: f.id })
      if (!result.success || !result.data) {
        if (result.error?.startsWith('FINDING_REQUIRES_TASK_CLOSURE')) {
          setManualCloseFinding(f)
          return
        }
        toast.error('Kunde inte stänga anmärkning', {
          description: result.error,
        })
        return
      }
      toast.success('Anmärkning markerad som åtgärdad')
      onFindingMutation(result.data.finding)
    },
    [onFindingMutation]
  )

  const handleManualCloseConfirm = useCallback(
    async (findingId: string, closeReason: string) => {
      const result = await closeFinding({ findingId, closeReason })
      if (!result.success || !result.data) {
        toast.error('Kunde inte stänga anmärkning', {
          description: result.error,
        })
        return
      }
      toast.success('Anmärkning markerad som åtgärdad med manuell anledning')
      onFindingMutation(result.data.finding)
      setManualCloseFinding(null)
    },
    [onFindingMutation]
  )

  const handleReopen = useCallback(
    async (f: FindingRow) => {
      const result = await reopenFinding(f.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte återöppna anmärkning', {
          description: result.error,
        })
        return
      }
      toast.success('Anmärkning återöppnad')
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

  // Epic 21 follow-up (verify step): confirm the verify dialog. Hits the
  // same closeFinding action as a plain "Stäng" but with an optional
  // verificationNote that becomes audit evidence via the finding_verified
  // activity log entry.
  const handleVerifyConfirm = useCallback(
    async (findingId: string, verificationNote: string | null) => {
      const result = await closeFinding({
        findingId,
        ...(verificationNote !== null ? { verificationNote } : {}),
      })
      if (!result.success || !result.data) {
        toast.error('Kunde inte verifiera anmärkning', {
          description: result.error,
        })
        return
      }
      toast.success('Anmärkning verifierad och stängd')
      onFindingMutation(result.data.finding)
      setVerifyFinding(null)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
        <Button
          type="button"
          onClick={openEditorForCreate}
          data-testid="cycle-findings-add-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Lägg till anmärkning
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
          {findings.length === 0
            ? 'Inga anmärkningar registrerade ännu.'
            : 'Inga anmärkningar matchar filtret.'}
        </div>
      ) : shouldVirtualise ? (
        <VirtualisedBody
          findings={filtered}
          virtualizer={virtualizer}
          scrollRef={scrollRef}
          onEdit={openEditorForEdit}
          onClose={handleClose}
          onReopen={handleReopen}
          onSpawnTask={handleSpawnTask}
          onVerify={setVerifyFinding}
          onFindingClick={onFindingClick}
        />
      ) : (
        <PlainBody
          findings={filtered}
          onEdit={openEditorForEdit}
          onClose={handleClose}
          onReopen={handleReopen}
          onSpawnTask={handleSpawnTask}
          onVerify={setVerifyFinding}
          onFindingClick={onFindingClick}
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

      <VerifyFindingDialog
        open={verifyFinding !== null}
        onOpenChange={(open) => {
          if (!open) setVerifyFinding(null)
        }}
        finding={verifyFinding}
        onConfirm={handleVerifyConfirm}
      />

      <ManualCloseFindingDialog
        open={manualCloseFinding !== null}
        onOpenChange={(open) => {
          if (!open) setManualCloseFinding(null)
        }}
        finding={manualCloseFinding}
        onConfirm={handleManualCloseConfirm}
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

  // Story 22.2 — chips migrated to <FilterChipGroup> + <FilterChip>. The
  // `role="group"` semantics are now owned by the primitive (no role="tab"
  // anywhere — the cycle-detail <Tabs> for view-switching stays separate).
  // TODO(22.2): add counts derived from filtered finding state. Out-of-scope
  // for this story per the AC ("counts optional, do not block").
  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterChipGroup aria-label="Filtrera anmärkningar efter typ">
        {typeOptions.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={typeFilter === opt.value}
            onPressedChange={() => setTypeFilter(opt.value)}
            data-testid={`finding-filter-type-${opt.value}`}
          >
            {opt.label}
          </FilterChip>
        ))}
      </FilterChipGroup>

      {typeFilter === FindingType.AVVIKELSE ? (
        <FilterChipGroup
          aria-label="Filtrera anmärkningar efter allvarlighetsgrad"
          data-testid="finding-filter-severity-group"
        >
          {severityOptions.map((opt) => (
            <FilterChip
              key={opt.value}
              pressed={severityFilter === opt.value}
              onPressedChange={() => setSeverityFilter(opt.value)}
              data-testid={`finding-filter-severity-${opt.value}`}
            >
              {opt.label}
            </FilterChip>
          ))}
        </FilterChipGroup>
      ) : null}

      <FilterChipGroup
        aria-label="Filtrera anmärkningar efter status"
        className="ml-auto"
      >
        {statusOptions.map((opt) => (
          <FilterChip
            key={opt.value}
            pressed={statusFilter === opt.value}
            onPressedChange={() => setStatusFilter(opt.value)}
            data-testid={`finding-filter-status-${opt.value}`}
          >
            {opt.label}
          </FilterChip>
        ))}
      </FilterChipGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows (Story 21.16 — delegates to shared FindingCard)
// ---------------------------------------------------------------------------

interface BodyProps {
  findings: FindingRow[]
  onEdit: (_f: FindingRow) => void
  onClose: (_f: FindingRow) => Promise<void>
  onReopen: (_f: FindingRow) => Promise<void>
  onSpawnTask: (_f: FindingRow) => Promise<void>
  onVerify: (_f: FindingRow) => void
  onFindingClick?: ((_f: FindingRow) => void) | undefined
}

function PlainBody({
  findings,
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
  onVerify,
  onFindingClick,
}: BodyProps) {
  return (
    <div
      role="list"
      className="flex flex-col gap-2"
      data-testid="cycle-findings-list"
    >
      {findings.map((f) => (
        <div
          key={f.id}
          role="listitem"
          data-testid={`cycle-finding-row-${f.id}`}
        >
          <FindingCard
            finding={f}
            onClick={onFindingClick ? () => onFindingClick(f) : undefined}
            showLawContext
            actions={
              <FindingActions
                finding={f}
                onEdit={() => onEdit(f)}
                onClose={() => onClose(f)}
                onReopen={() => onReopen(f)}
                onSpawnTask={() => onSpawnTask(f)}
                onVerify={() => onVerify(f)}
              />
            }
          />
        </div>
      ))}
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
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
  onVerify,
  onFindingClick,
}: VirtualisedBodyProps) {
  return (
    <div
      ref={scrollRef}
      className="max-h-[calc(100vh-22rem)] overflow-auto rounded-md"
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
          return (
            <div
              key={f.id}
              data-index={vr.index}
              ref={(node) => {
                if (node) virtualizer.measureElement(node)
              }}
              role="listitem"
              data-testid={`cycle-finding-row-${f.id}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vr.start}px)`,
                padding: '4px 0',
              }}
            >
              <FindingCard
                finding={f}
                onClick={onFindingClick ? () => onFindingClick(f) : undefined}
                showLawContext
                actions={
                  <FindingActions
                    finding={f}
                    onEdit={() => onEdit(f)}
                    onClose={() => onClose(f)}
                    onReopen={() => onReopen(f)}
                    onSpawnTask={() => onSpawnTask(f)}
                    onVerify={() => onVerify(f)}
                  />
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline action buttons — rendered in FindingCard's `actions` slot.
// ---------------------------------------------------------------------------

interface FindingActionsProps {
  finding: FindingRow
  onEdit: () => void
  onClose: () => Promise<void>
  onReopen: () => Promise<void>
  onSpawnTask: () => Promise<void>
  onVerify: () => void
}

function FindingActions({
  finding,
  onEdit,
  onClose,
  onReopen,
  onSpawnTask,
  onVerify,
}: FindingActionsProps) {
  // Phase 2 / Epic 23 foundation: 5-state derivation; collapse the three
  // closed variants (closed-verified / closed-plain / closed-dismissed) into
  // a single Återöppna affordance. Phase 3 will replace this entire FindingActions
  // block with click-row → FindingModal navigation.
  const status = getFindingStatus(finding)
  const isClosed =
    status === 'closed-verified' ||
    status === 'closed-plain' ||
    status === 'closed-dismissed'

  if (isClosed) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onReopen}
        data-testid={`cycle-finding-reopen-${finding.id}`}
      >
        Återöppna
      </Button>
    )
  }

  if (status === 'ready-to-verify') {
    // Linked task is done — auditor's explicit verify moment replaces the
    // plain Stäng. "Redigera" stays available; "+ Skapa åtgärdsuppgift"
    // hides because the task already exists.
    return (
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
          onClick={onVerify}
          data-testid={`cycle-finding-verify-${finding.id}`}
        >
          Verifiera
        </Button>
      </>
    )
  }

  // status === 'open' — no task OR task not yet completed.
  return (
    <>
      {finding.correctiveActionTaskId === null ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onSpawnTask}
          title="Skapa en åtgärdsuppgift kopplad till denna anmärkning"
          data-testid={`cycle-finding-spawn-task-${finding.id}`}
        >
          <Plus className="mr-1 h-3 w-3" />
          Skapa åtgärdsuppgift
        </Button>
      ) : null}
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
        Markera som åtgärdat
      </Button>
    </>
  )
}

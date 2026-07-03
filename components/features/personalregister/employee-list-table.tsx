'use client'

/**
 * Story 7.2: Personalregister employee table.
 *
 * Parallel component to the canonical Laglistor `DocumentListTable` /
 * `GroupedDocumentListTable` (approved deviation: that table is hardcoded to
 * `ColumnDef<DocumentListItem>` with no external column API, so this one is
 * built on the same scaffolding but typed over `EmployeeRow`). The Laglistor
 * components are NOT modified or imported.
 *
 * - TanStack table per group section, shared shadcn `Table` primitives,
 *   `EmptyState`.
 * - Story 7.4 (Task 3b, law-table design parity): emphasized two-line
 *   Anställd primary column, hover-reveal sort affordance + thin header
 *   column separators (local `EmployeeSortableHeader` — the shared
 *   `SortableHeader`'s always-on ⇅ icons were the flagged noise),
 *   `ÅÅMMDD-XXXX` personnummer display formatting, and Visa alla / Dölj
 *   alla group controls. Deliberate NON-adaptations: bulk checkboxes
 *   (no bulk ops until 7.6), Typ entity-icon column, avatar column.
 * - Story 7.4: amber "Ej komplett" status badge + per-group
 *   "{n}/{m} kompletta" rollups, all derived from the single
 *   `assessEmployeeCompleteness` rule over UNFILTERED rows.
 * - Grouped rendering: collapsible sections ordered by `EmployeeGroup.position`,
 *   "Ogrupperad" last; empty groups still render so a newly created group is
 *   immediately a drag target.
 * - Drag row → group header via dnd-kit; inline group select per row.
 * - Story 7.4b: column show/hide ("Kolumner" — the shared law-table
 *   affordance) + resize with per-column clamped bounds and
 *   `columnResizeMode: 'onEnd'` (the law table's drag-to-infinite-width fix,
 *   not reintroduced). State persists per user in localStorage keyed by
 *   workspace id — deliberately NOT the document-list Zustand store. No
 *   column reordering (explicit user exclusion).
 * - No row virtualization (registers are small).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ExpandIcon,
  Folder,
  FolderX,
  GripVertical,
  MinusIcon,
  Plus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { assessEmployeeCompleteness } from '@/lib/employees/employee-completeness'
import type { EmployeeGroupSummary } from '@/app/actions/employees'
import type { EmployeeRow } from './employee-row'
import { EmployeeGroupEditor } from './employee-group-editor'
import {
  EmployeeColumnSettings,
  EMPLOYEE_COLUMN_LABELS,
} from './employee-column-settings'
import {
  clampEmployeeColumnSizing,
  defaultEmployeeColumnState,
  loadEmployeeColumnState,
  sanitizeEmployeeColumnVisibility,
  saveEmployeeColumnState,
  type EmployeeColumnState,
} from './employee-column-state'
import { formatPersonnummerDisplay } from './format-personnummer'
import { EmployeeStatusBadge } from './personalkort-modal/status-badge'
import {
  employmentFormLabel,
  personelTypeLabel,
  salaryFormLabel,
  EMPTY_FIELD_LABEL,
} from './labels'

// Sentinel id for the ungrouped section (mirrors GroupedDocumentListTable)
const UNGROUPED_ID = '__ungrouped__'
const GROUP_HEADER_PREFIX = 'group-header-'

interface EmployeeListTableProps {
  /** Rows to display (already tab/search-filtered by the parent). */
  employees: EmployeeRow[]
  /**
   * ALL rows, unfiltered — group item counts and the empty-group hint are
   * computed from these (QA UX-001: filtering affects visible rows, not
   * group emptiness semantics).
   */
  allEmployees: EmployeeRow[]
  groups: EmployeeGroupSummary[]
  canManage: boolean
  /** Total number of employees in the workspace (unfiltered). */
  totalCount: number
  /**
   * Story 7.4: workspace kollektivavtal flag — feeds the completeness rule
   * behind the "Ej komplett" badge and the group rollups.
   */
  workspaceHasCollectiveAgreement: boolean
  onRowClick: (_employeeId: string) => void
  onMoveToGroup: (
    _employeeId: string,
    _groupId: string | null
  ) => Promise<boolean>
  /** Opens create mode (`?anstalld=ny`). Shown in the empty state for manage roles. */
  onAddEmployee?: (() => void) | undefined
}

export function EmployeeListTable({
  employees,
  allEmployees,
  groups,
  canManage,
  totalCount,
  workspaceHasCollectiveAgreement,
  onRowClick,
  onMoveToGroup,
  onAddEmployee,
}: EmployeeListTableProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overGroupId, setOverGroupId] = useState<string | null>(null)
  // Collapsed-state per group id; groups default to expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({})

  // Story 7.4b: column visibility + sizing, persisted per user per workspace.
  // The workspace id comes off the rows themselves (every EmployeeRow is
  // workspace-scoped) — an empty register has no rows and nothing worth
  // persisting, so persistence is simply skipped then.
  const workspaceId = allEmployees[0]?.workspace_id ?? null
  const [columnState, setColumnState] = useState<EmployeeColumnState>(
    defaultEmployeeColumnState
  )

  // Hydrate AFTER mount: the island is server-rendered, so reading
  // localStorage during the first render would mismatch hydration. Corrupt
  // or stale stored state degrades to defaults inside the loader.
  useEffect(() => {
    if (!workspaceId) return
    setColumnState(loadEmployeeColumnState(workspaceId))
  }, [workspaceId])

  // Story 7.6 (STATE-001): functional setState — the handlers derive the next
  // state from `prev`, never from a captured `columnState` (a stale closure
  // could otherwise clobber the sibling half of the state on rapid updates).
  const applyColumnState = useCallback(
    (compute: (_prev: EmployeeColumnState) => EmployeeColumnState) => {
      setColumnState((prev) => {
        const next = compute(prev)
        // Persistence is skipped when there's no workspace id (empty register).
        if (workspaceId) saveEmployeeColumnState(workspaceId, next)
        return next
      })
    },
    [workspaceId]
  )

  const handleColumnVisibilityChange = useCallback(
    (visibility: VisibilityState) => {
      // Sanitizer drops non-hideable ids (Anställd, drag handle) — defense
      // in depth on top of `enableHiding: false` and the disabled checkbox.
      applyColumnState((prev) => ({
        visibility: sanitizeEmployeeColumnVisibility(visibility),
        sizing: prev.sizing,
      }))
    },
    [applyColumnState]
  )

  // Clamp BEFORE storing (law-table fix: `onEnd` mode commits
  // `startSize + deltaOffset` unclamped on extreme drags).
  const handleColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      applyColumnState((prev) => ({
        visibility: prev.visibility,
        sizing: clampEmployeeColumnSizing(
          typeof updater === 'function' ? updater(prev.sizing) : updater
        ),
      }))
    },
    [applyColumnState]
  )

  const columnControls: EmployeeColumnControls = useMemo(
    () => ({
      visibility: columnState.visibility,
      sizing: columnState.sizing,
      onVisibilityChange: handleColumnVisibilityChange,
      onSizingChange: handleColumnSizingChange,
    }),
    [columnState, handleColumnVisibilityChange, handleColumnSizingChange]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Prioritize group-header drop targets (same approach as
  // GroupedDocumentListTable's collision detection).
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    const headerCollision = pointerCollisions.find((collision) =>
      String(collision.id).startsWith(GROUP_HEADER_PREFIX)
    )
    if (headerCollision) return [headerCollision]
    return rectIntersection(args)
  }, [])

  // Distribute rows into group sections; ungrouped last.
  const { groupedRows, ungroupedRows } = useMemo(() => {
    const grouped: Record<string, EmployeeRow[]> = {}
    const ungrouped: EmployeeRow[] = []

    groups.forEach((group) => {
      grouped[group.id] = []
    })

    employees.forEach((employee) => {
      const section = employee.group_id ? grouped[employee.group_id] : undefined
      if (section) {
        section.push(employee)
      } else {
        ungrouped.push(employee)
      }
    })

    return { groupedRows: grouped, ungroupedRows: ungrouped }
  }, [employees, groups])

  // UNFILTERED per-section counts (QA UX-001): a group's item count and its
  // "empty" state must not change while a tab/search filter is active.
  // Story 7.4: the same unfiltered rows also feed the per-group
  // "{n}/{m} kompletta" rollup — one source, zero drift.
  const unfilteredCounts = useMemo(() => {
    const counts: Record<string, { total: number; complete: number }> = {}
    const groupIds = new Set(groups.map((g) => g.id))
    allEmployees.forEach((employee) => {
      const key =
        employee.group_id && groupIds.has(employee.group_id)
          ? employee.group_id
          : UNGROUPED_ID
      const entry = (counts[key] ??= { total: 0, complete: 0 })
      entry.total += 1
      if (
        assessEmployeeCompleteness(employee, {
          workspaceHasCollectiveAgreement,
        }).complete
      ) {
        entry.complete += 1
      }
    })
    return counts
  }, [allEmployees, groups, workspaceHasCollectiveAgreement])

  // Dragging is only meaningful when there are group headers to drop on.
  const dragEnabled = canManage && groups.length > 0

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(() => {
    const cols: ColumnDef<EmployeeRow>[] = []

    // Story 7.4b: size/minSize/maxSize mirror EMPLOYEE_COLUMN_SIZE_BOUNDS in
    // employee-column-state.ts (the clamp source of truth); labels come from
    // EMPLOYEE_COLUMN_LABELS so headers and the Kolumner toggle list share
    // one Swedish label source. Structural chrome (dragHandle) is neither
    // hideable nor resizable; Anställd (name) is never hideable (AC2).
    if (dragEnabled) {
      cols.push({
        id: 'dragHandle',
        header: () => null,
        cell: () => null, // Rendered by EmployeeTableRow
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
      })
    }

    cols.push(
      {
        id: 'employee_id_ref',
        accessorFn: (row) => row.employee_id_ref ?? '',
        size: 130,
        minSize: 100,
        maxSize: 220,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.employee_id_ref ?? ''}
          />
        ),
        cell: ({ row }) =>
          row.original.employee_id_ref ?? (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          ),
      },
      {
        id: 'name',
        accessorFn: (row) =>
          `${row.last_name} ${row.first_name}`.toLocaleLowerCase('sv-SE'),
        size: 220,
        minSize: 160,
        maxSize: 480,
        enableHiding: false, // AC2: the primary/identity column stays.
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.name ?? ''}
          />
        ),
        // Task 3b: emphasized primary column (law-table convention) — bold
        // name + muted job title second line. The line is OMITTED when
        // job_title is empty (deliberately no "Ej ifylld" here: the primary
        // identity cell is not a data-quality surface).
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </div>
            {row.original.job_title ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.original.job_title}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'personnummer',
        accessorFn: (row) => row.personnummer ?? '',
        size: 140,
        minSize: 120,
        maxSize: 200,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.personnummer ?? ''}
          />
        ),
        // The repository already decrypted (manage) or masked (view) the
        // value — the UI renders what it received, never touches crypto.
        // Task 3b: ÅÅMMDD-XXXX is DISPLAY formatting only; masked values
        // render exactly as received.
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.personnummer === null
              ? '—'
              : row.original.personnummer_masked
                ? row.original.personnummer
                : formatPersonnummerDisplay(row.original.personnummer)}
          </span>
        ),
      },
      {
        id: 'personel_type',
        accessorFn: (row) => personelTypeLabel(row.personel_type),
        size: 140,
        minSize: 110,
        maxSize: 220,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.personel_type ?? ''}
          />
        ),
        cell: ({ row }) =>
          row.original.personel_type ? (
            personelTypeLabel(row.original.personel_type)
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          ),
      },
      {
        id: 'employment_form',
        accessorFn: (row) => employmentFormLabel(row.employment_form),
        size: 160,
        minSize: 130,
        maxSize: 260,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.employment_form ?? ''}
          />
        ),
        cell: ({ row }) =>
          row.original.employment_form ? (
            employmentFormLabel(row.original.employment_form)
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          ),
      },
      {
        id: 'salary_form',
        accessorFn: (row) => salaryFormLabel(row.salary_form),
        size: 130,
        minSize: 110,
        maxSize: 220,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.salary_form ?? ''}
          />
        ),
        cell: ({ row }) =>
          row.original.salary_form ? (
            salaryFormLabel(row.original.salary_form)
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          ),
      },
      {
        id: 'collective_agreement',
        accessorFn: (row) => row.collective_agreement?.name ?? '',
        size: 170,
        minSize: 130,
        maxSize: 300,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.collective_agreement ?? ''}
          />
        ),
        cell: ({ row }) =>
          row.original.collective_agreement?.name ?? (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          ),
      },
      {
        id: 'group',
        accessorFn: (row) => row.group?.name ?? '',
        size: 160,
        minSize: 120,
        maxSize: 280,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.group ?? ''}
          />
        ),
        cell: ({ row }) =>
          canManage ? (
            <EmployeeGroupEditor
              value={row.original.group_id}
              groupName={row.original.group?.name ?? null}
              groups={groups}
              onChange={(groupId) => onMoveToGroup(row.original.id, groupId)}
            />
          ) : (
            <span className="text-xs">
              {row.original.group?.name ?? 'Ogrupperad'}
            </span>
          ),
      },
      {
        id: 'status',
        accessorFn: (row) => (row.inactive ? 1 : 0),
        size: 170,
        minSize: 140,
        maxSize: 260,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.status ?? ''}
          />
        ),
        // Story 7.4: amber "Ej komplett" rides ALONGSIDE Aktiv/Inaktiv
        // (Fortnox mirror — incomplete is orthogonal to inactive). Badge
        // tones come from the tone-aware API, never hand-rolled classes.
        cell: ({ row }) => {
          const { complete } = assessEmployeeCompleteness(row.original, {
            workspaceHasCollectiveAgreement,
          })
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <EmployeeStatusBadge inactive={row.original.inactive} />
              {!complete && (
                <Badge tone="warning" variant="soft">
                  Ej komplett
                </Badge>
              )}
            </div>
          )
        },
      }
    )

    return cols
  }, [
    canManage,
    dragEnabled,
    groups,
    onMoveToGroup,
    workspaceHasCollectiveAgreement,
  ])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setOverGroupId(null)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event
      if (!over) {
        setOverGroupId(null)
        return
      }

      const overId = String(over.id)
      if (!overId.startsWith(GROUP_HEADER_PREFIX)) {
        setOverGroupId(null)
        return
      }

      const groupId = overId.slice(GROUP_HEADER_PREFIX.length)
      const targetGroupId = groupId === UNGROUPED_ID ? null : groupId
      const employee = employees.find((e) => e.id === String(active.id))
      // Only highlight when the drop would actually move the employee.
      setOverGroupId(
        employee && employee.group_id !== targetGroupId ? groupId : null
      )
    },
    [employees]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverGroupId(null)

      if (!over) return
      const overId = String(over.id)
      if (!overId.startsWith(GROUP_HEADER_PREFIX)) return

      const groupId = overId.slice(GROUP_HEADER_PREFIX.length)
      const targetGroupId = groupId === UNGROUPED_ID ? null : groupId
      const employee = employees.find((e) => e.id === String(active.id))
      if (!employee || employee.group_id === targetGroupId) return

      await onMoveToGroup(employee.id, targetGroupId)
    },
    [employees, onMoveToGroup]
  )

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  // Task 3b: Visa alla / Dölj alla (law-table parity — same placement and
  // ghost-button affordance as GroupedDocumentListTable's controls).
  const handleExpandAll = useCallback(() => {
    setCollapsedGroups({})
  }, [])

  const handleCollapseAll = useCallback(() => {
    const collapsed: Record<string, boolean> = { [UNGROUPED_ID]: true }
    groups.forEach((group) => {
      collapsed[group.id] = true
    })
    setCollapsedGroups(collapsed)
  }, [groups])

  const activeEmployee = activeId
    ? employees.find((e) => e.id === activeId)
    : null

  // Empty register (no employees at all in the workspace)
  if (totalCount === 0 && groups.length === 0) {
    return (
      <EmptyState
        icon={
          <EmptyState.Icon>
            <Users className="h-8 w-8 text-muted-foreground" />
          </EmptyState.Icon>
        }
        description="Inga anställda ännu."
        action={
          canManage && onAddEmployee ? (
            <Button size="sm" onClick={onAddEmployee}>
              <Plus className="mr-1.5 h-4 w-4" />
              Lägg till anställd
            </Button>
          ) : null
        }
      />
    )
  }

  const hasGroups = groups.length > 0

  // Flat table when no groups exist
  if (!hasGroups) {
    if (employees.length === 0) {
      return (
        <EmptyState
          icon={
            <EmptyState.Icon>
              <Users className="h-8 w-8 text-muted-foreground" />
            </EmptyState.Icon>
          }
          description="Inga anställda matchar filtret."
        />
      )
    }

    return (
      <div className="flex flex-col gap-4">
        {/* Story 7.4b: Kolumner control — same right-aligned toolbar slot as
            the grouped branch. */}
        <div className="flex justify-end">
          <EmployeeColumnSettings
            columnVisibility={columnState.visibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />
        </div>
        <div className="rounded-md border overflow-x-auto">
          <EmployeeSectionTable
            rows={ungroupedRows}
            columns={columns}
            dragEnabled={false}
            onRowClick={onRowClick}
            columnControls={columnControls}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {employees.length} av {totalCount} anställda.
          {canManage && (
            <span className="hidden sm:inline ml-1">
              Dra till grupprubriker för att flytta.
            </span>
          )}
        </p>
        {/* Task 3b: expand/collapse-all controls above the group sections
            (law-table placement + affordance). */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Story 7.4b: Kolumner control (shared law-table affordance). */}
          <EmployeeColumnSettings
            columnVisibility={columnState.visibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="h-8 text-xs px-2 sm:px-3"
            title="Visa alla grupper"
          >
            <ExpandIcon className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Visa alla</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="h-8 text-xs px-2 sm:px-3"
            title="Dölj alla grupper"
          >
            <MinusIcon className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Dölj alla</span>
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <EmployeeGroupSection
              key={group.id}
              groupId={group.id}
              name={group.name}
              rows={groupedRows[group.id] ?? []}
              unfilteredCount={unfilteredCounts[group.id]?.total ?? 0}
              unfilteredCompleteCount={
                unfilteredCounts[group.id]?.complete ?? 0
              }
              columns={columns}
              columnControls={columnControls}
              canManage={canManage}
              isExpanded={!collapsedGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              onRowClick={onRowClick}
              isDropTarget={overGroupId === group.id}
            />
          ))}

          <EmployeeGroupSection
            groupId={UNGROUPED_ID}
            name="Ogrupperad"
            rows={ungroupedRows}
            unfilteredCount={unfilteredCounts[UNGROUPED_ID]?.total ?? 0}
            unfilteredCompleteCount={
              unfilteredCounts[UNGROUPED_ID]?.complete ?? 0
            }
            columns={columns}
            columnControls={columnControls}
            canManage={canManage}
            isExpanded={!collapsedGroups[UNGROUPED_ID]}
            onToggle={() => toggleGroup(UNGROUPED_ID)}
            onRowClick={onRowClick}
            isUngrouped
            isDropTarget={overGroupId === UNGROUPED_ID}
          />
        </div>

        {/* dropAnimation={null} prevents the "return to origin" ghost effect */}
        <DragOverlay dropAnimation={null}>
          {activeEmployee && (
            <div className="bg-background border rounded-md p-3 shadow-lg opacity-90">
              <span className="font-medium text-sm">
                {activeEmployee.first_name} {activeEmployee.last_name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ============================================================================
// Group section (collapsible, droppable header)
// ============================================================================

interface EmployeeGroupSectionProps {
  groupId: string
  name: string
  rows: EmployeeRow[]
  /** Total rows in this section, ignoring the active tab/search filter. */
  unfilteredCount: number
  /** Complete rows in this section (unfiltered) — Story 7.4 rollup. */
  unfilteredCompleteCount: number
  columns: ColumnDef<EmployeeRow>[]
  columnControls: EmployeeColumnControls
  canManage: boolean
  isExpanded: boolean
  onToggle: () => void
  onRowClick: (_employeeId: string) => void
  isUngrouped?: boolean
  isDropTarget?: boolean
}

function EmployeeGroupSection({
  groupId,
  name,
  rows,
  unfilteredCount,
  unfilteredCompleteCount,
  columns,
  columnControls,
  canManage,
  isExpanded,
  onToggle,
  onRowClick,
  isUngrouped = false,
  isDropTarget = false,
}: EmployeeGroupSectionProps) {
  // Make the group header a drop target
  const { setNodeRef } = useDroppable({
    id: `${GROUP_HEADER_PREFIX}${groupId}`,
  })

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border transition-colors',
          isDropTarget
            ? 'border-primary border-2 bg-primary/5'
            : 'border-border/50 bg-muted/20'
        )}
      >
        <div className="flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 min-h-[44px]">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-2 -m-1 rounded hover:bg-muted transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[44px] min-h-[44px] flex items-center justify-center'
              )}
              title={isExpanded ? 'Fäll ihop' : 'Expandera'}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>

          <span className="hidden sm:block">
            {isUngrouped ? (
              <FolderX className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-primary shrink-0" />
            )}
          </span>

          <span className="font-medium flex-1 text-left text-sm sm:text-base">
            {name}
          </span>

          {/* Unfiltered counts — group size must not change while searching
              (QA UX-001). Story 7.4: "{n}/{m} kompletta" rollup, both counts
              from the same unfiltered source as the header stat. */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {unfilteredCount === 0
              ? '0'
              : `${unfilteredCompleteCount}/${unfilteredCount} kompletta`}
          </span>
        </div>

        <CollapsibleContent>
          <div className="pb-3 sm:pb-4">
            {rows.length === 0 ? (
              // QA UX-001: only a TRULY empty group (unfiltered) shows the
              // drag-here hint; a group whose rows are merely filtered out
              // says so instead of pretending to be empty.
              <p className="text-sm text-muted-foreground py-4 text-center">
                {unfilteredCount > 0
                  ? 'Inga träffar i denna grupp.'
                  : canManage
                    ? 'Dra anställda hit.'
                    : 'Inga anställda i denna grupp.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <EmployeeSectionTable
                  rows={rows}
                  columns={columns}
                  dragEnabled={canManage}
                  onRowClick={onRowClick}
                  columnControls={columnControls}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ============================================================================
// Inner table (one TanStack instance per section)
// ============================================================================

/**
 * Story 7.4b: shared column show/hide + resize state, lifted to
 * `EmployeeListTable` so every group section renders the same columns at the
 * same widths (one TanStack instance per section, one state above them).
 */
interface EmployeeColumnControls {
  visibility: VisibilityState
  sizing: ColumnSizingState
  onVisibilityChange: (_visibility: VisibilityState) => void
  onSizingChange: (_updater: Updater<ColumnSizingState>) => void
}

interface EmployeeSectionTableProps {
  rows: EmployeeRow[]
  columns: ColumnDef<EmployeeRow>[]
  dragEnabled: boolean
  onRowClick: (_employeeId: string) => void
  columnControls: EmployeeColumnControls
}

function EmployeeSectionTable({
  rows,
  columns,
  dragEnabled,
  onRowClick,
  columnControls,
}: EmployeeSectionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility: columnControls.visibility,
      columnSizing: columnControls.sizing,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(columnControls.visibility)
          : updater
      columnControls.onVisibilityChange(next)
    },
    onColumnSizingChange: columnControls.onSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableColumnResizing: true,
    // Law-table parity: commit on drag END — per-frame commits were part of
    // the historical drag-to-infinite-width bug.
    columnResizeMode: 'onEnd',
  })

  // Live resize preview clamped to the column's declared bounds (law-table
  // `getColumnWidth` parity). Also clamps stale persisted sizes defensively —
  // TanStack's `onEnd` mode commits values unclamped.
  const { columnSizingInfo } = table.getState()
  const getColumnWidth = (headerId: string, defaultSize: number) => {
    const column = table.getColumn(headerId)
    const minSize = column?.columnDef.minSize ?? 0
    const maxSize = column?.columnDef.maxSize ?? Infinity
    if (columnSizingInfo.isResizingColumn === headerId) {
      const newSize =
        (columnSizingInfo.startSize ?? defaultSize) +
        (columnSizingInfo.deltaOffset ?? 0)
      return Math.max(minSize, Math.min(maxSize, newSize))
    }
    return Math.max(minSize, Math.min(maxSize, defaultSize))
  }

  // Sum of visible column widths; combined with the trailing spacer cell it
  // keeps declared widths honest under `table-fixed` when the column-sum is
  // narrower than the container (law-table approach).
  const liveTotalWidth = table
    .getVisibleLeafColumns()
    .reduce((sum, col) => sum + getColumnWidth(col.id, col.getSize()), 0)

  return (
    <Table className="table-fixed" style={{ minWidth: liveTotalWidth }}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                style={{ width: getColumnWidth(header.id, header.getSize()) }}
                // `group/head` scopes the hover-reveal sort affordance to
                // the hovered column only (Task 3b — law-table parity).
                // `overflow-hidden whitespace-nowrap`: a narrow column CLIPS
                // its own label — it must never spill into the neighbour's
                // header (user checkpoint: "Anställnings-IDAnställd" overlap).
                className={cn(
                  'group/head relative overflow-hidden whitespace-nowrap',
                  header.id === 'dragHandle' && 'px-2'
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                {/* Story 7.4b: resize grip at the header's right edge — a
                    separate hit area from the sort button, and pointer-down
                    stops propagation so a drag never triggers a sort. The
                    grip doubles as the thin column separator (it replaces
                    the previous decorative span — law-table affordance). */}
                {header.column.getCanResize() && (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      'absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none group/resize',
                      'flex items-center justify-center'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-0.5 rounded-full bg-border transition-colors',
                        'group-hover/resize:bg-primary group-hover/resize:h-6',
                        header.column.getIsResizing() && 'bg-primary h-6'
                      )}
                    />
                  </div>
                )}
              </TableHead>
            ))}
            {/* Spacer absorbs leftover width so fixed-width columns don't
                inflate proportionally (law-table parity). */}
            <TableHead aria-hidden="true" className="p-0" />
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <EmployeeTableRow
            key={row.id}
            row={row}
            dragEnabled={dragEnabled}
            onRowClick={onRowClick}
          />
        ))}
      </TableBody>
    </Table>
  )
}

// ============================================================================
// Story 7.4 (Task 3b): sortable header with hover-reveal affordance
// ============================================================================

/**
 * Same contract and sorting semantics as the shared `SortableHeader`
 * (ghost button, `toggleSorting(sorted === 'asc')`), but the ⇅ icon is
 * hidden until the column is hovered or actively sorted — the always-on
 * icons on every column were the flagged header noise. Requires the
 * wrapping `TableHead` to carry the `group/head` class.
 */
function EmployeeSortableHeader({
  column,
  label,
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (_desc?: boolean) => void
  }
  label: string
}) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="-ml-4 h-8"
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown
          aria-hidden="true"
          className="ml-2 h-4 w-4 opacity-0 transition-opacity group-hover/head:opacity-50 group-focus-within/head:opacity-50"
        />
      )}
    </Button>
  )
}

// ============================================================================
// Draggable row with interactive-element click guard
// ============================================================================

function EmployeeTableRow({
  row,
  dragEnabled,
  onRowClick,
}: {
  row: Row<EmployeeRow>
  dragEnabled: boolean
  onRowClick: (_employeeId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: row.original.id, disabled: !dragEnabled })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  // Row click opens the Personalkort param — ignore interactive elements
  // (same guard as the Laglistor SortableRow).
  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      const target = e.target as HTMLElement
      if (
        target.closest(
          'button, input, select, a, [role="combobox"], [role="checkbox"]'
        )
      ) {
        return
      }
      onRowClick(row.original.id)
    },
    [onRowClick, row.original.id]
  )

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer hover:bg-muted/50"
      onClick={handleRowClick}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          // Nowrap + clip: shrinking a column truncates cell content instead
          // of wrapping it to two lines (user checkpoint: `890503-` / `2556`).
          className={cn(
            'overflow-hidden whitespace-nowrap',
            cell.column.id === 'dragHandle' && 'px-2'
          )}
        >
          {cell.column.id === 'dragHandle' ? (
            <button
              {...attributes}
              {...listeners}
              className="flex w-full items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              aria-label="Dra för att flytta"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
      {/* Matches the header's width-absorbing spacer (Story 7.4b). */}
      <TableCell aria-hidden="true" className="p-0" />
    </TableRow>
  )
}

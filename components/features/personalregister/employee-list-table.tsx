'use client'

/**
 * Story 7.4/7.4b/7.10 → migrated in Story 28.7 (Epic 28) onto the unified
 * DataTable core's GroupedDataTable. This file owns the employee columns
 * (masking-aware cells untouched), group-header rollups, empty states and
 * the drag-source grip; sections, collapse, per-section sorting, the
 * DndContext with header-prioritizing collision, drop targets and the
 * DragOverlay live in components/ui/data-table.
 *
 * Persistence contract unchanged: column visibility/sizing stays OWNED by
 * the parent island through employee-column-state.ts (per-workspace
 * localStorage, sanitize-on-read) — this table remains controlled.
 */

import { useCallback, useMemo, useState } from 'react'
import type {
  ColumnDef,
  ColumnSizingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  GroupedDataTable,
  type DataTableSection,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Folder,
  FolderX,
  GripVertical,
  Maximize2 as ExpandIcon,
  Minus as MinusIcon,
  Plus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { assessEmployeeCompleteness } from '@/lib/employees/employee-completeness'
import type { EmployeeGroupSummary } from '@/app/actions/employees'
import type { EmployeeRow } from './employee-row'
import { EmployeeGroupEditor } from './employee-group-editor'
import { EMPLOYEE_COLUMN_LABELS } from './employee-column-settings'
import { formatPersonnummerDisplay } from './format-personnummer'
import { EmployeeStatusBadge } from './personalkort-modal/status-badge'
import {
  employmentFormLabel,
  personelTypeLabel,
  salaryFormLabel,
  formatMonthlySalary,
  formatHourlyPay,
  EMPTY_FIELD_LABEL,
} from './labels'

const UNGROUPED_ID = '__ungrouped__'

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
  /**
   * Column show/hide + resize state (Story 7.4b + 7.10), OWNED by the parent
   * island (`personalregister-content.tsx`) so the "Kolumner" control can sit
   * in the shared toolbar row. This table is controlled: it renders columns at
   * these widths/visibility and reports changes back through the handlers.
   */
  columnVisibility: VisibilityState
  columnSizing: ColumnSizingState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
  onColumnSizingChange: (_updater: Updater<ColumnSizingState>) => void
  onRowClick: (_employeeId: string) => void
  onMoveToGroup: (
    _employeeId: string,
    _groupId: string | null
  ) => Promise<boolean>
  /** Opens create mode (`?anstalld=ny`). Shown in the empty state for manage roles. */
  onAddEmployee?: (() => void) | undefined
}

/**
 * Drag-source grip cell: the row is dragged BY its handle (dnd-kit
 * useDraggable on the button); GroupedDataTable owns the DndContext and
 * the droppable group headers.
 */
function EmployeeDragHandleCell({ employeeId }: { employeeId: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: employeeId,
  })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="flex w-full items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      aria-label="Dra för att flytta"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}

/**
 * Story 7.4 (Task 3b): sortable header with hover-reveal affordance — the ⇅
 * icon is hidden until the column is hovered or actively sorted. The core's
 * header cells carry the `group/head` class this relies on.
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

export function EmployeeListTable({
  employees,
  allEmployees,
  groups,
  canManage,
  totalCount,
  workspaceHasCollectiveAgreement,
  columnVisibility,
  columnSizing,
  onColumnVisibilityChange,
  onColumnSizingChange,
  onRowClick,
  onMoveToGroup,
  onAddEmployee,
}: EmployeeListTableProps) {
  // Collapse state as a Set (GroupedDataTable contract).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Dragging is only meaningful when there are group headers to drop on.
  const dragEnabled = canManage && groups.length > 0

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

  const columns = useMemo<ColumnDef<EmployeeRow, unknown>[]>(() => {
    const cols: ColumnDef<EmployeeRow, unknown>[] = []

    // Story 7.4b: size/minSize/maxSize mirror EMPLOYEE_COLUMN_SIZE_BOUNDS in
    // employee-column-state.ts (the clamp source of truth); labels come from
    // EMPLOYEE_COLUMN_LABELS so headers and the Kolumner toggle list share
    // one Swedish label source. Structural chrome (dragHandle) is neither
    // hideable nor resizable; Anställd (name) is never hideable (AC2).
    if (dragEnabled) {
      cols.push({
        id: 'dragHandle',
        header: () => null,
        cell: ({ row }) => (
          <EmployeeDragHandleCell employeeId={row.original.id} />
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        meta: {
          dt: {
            label: 'Flytta',
            pinned: 'left',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.employee_id_ref ?? 'Anställnings-ID',
            nowrap: true,
            card: {
              role: 'meta',
              priority: 4,
              renderCard: (row) =>
                row.original.employee_id_ref ? (
                  <span className="text-sm">
                    {row.original.employee_id_ref}
                  </span>
                ) : null,
            },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.name ?? 'Anställd',
            fill: true,
            mandatory: true,
            nowrap: true,
            card: { role: 'title' },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.personnummer ?? 'Personnummer',
            nowrap: true,
            card: {
              role: 'meta',
              priority: 1,
              renderCard: (row) =>
                row.original.personnummer === null ? null : (
                  <span className="tabular-nums text-sm">
                    {row.original.personnummer_masked
                      ? row.original.personnummer
                      : formatPersonnummerDisplay(row.original.personnummer)}
                  </span>
                ),
            },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.personel_type ?? 'Personaltyp',
            nowrap: true,
            card: {
              role: 'meta',
              priority: 2,
              renderCard: (row) =>
                row.original.personel_type ? (
                  <span className="text-sm">
                    {personelTypeLabel(row.original.personel_type)}
                  </span>
                ) : null,
            },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.employment_form ?? 'Anställningsform',
            nowrap: true,
            card: {
              role: 'meta',
              priority: 3,
              renderCard: (row) =>
                row.original.employment_form ? (
                  <span className="text-sm">
                    {employmentFormLabel(row.original.employment_form)}
                  </span>
                ) : null,
            },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.salary_form ?? 'Löneform',
            nowrap: true,
            card: { role: 'hidden' },
          },
        },
      },
      {
        // Story 7.10: Lön — HIDDEN BY DEFAULT (screen-share privacy). The
        // repository has already decrypted (manage) or masked (view) the value
        // BEFORE serialization, so the cell never touches crypto and a view
        // browser never received the amount regardless of this toggle.
        id: 'salary',
        accessorFn: (row) => row.monthly_salary ?? row.hourly_pay ?? '',
        size: 130,
        minSize: 120,
        maxSize: 200,
        header: ({ column }) => (
          <EmployeeSortableHeader
            column={column}
            label={EMPLOYEE_COLUMN_LABELS.salary ?? ''}
          />
        ),
        cell: ({ row }) => {
          const { salary_masked, monthly_salary, hourly_pay, salary_form } =
            row.original
          // Masked (view role, or an undecryptable ciphertext) → render the
          // fixed mask the repo already put on the value; never a real amount.
          if (salary_masked) {
            return (
              <span className="tabular-nums">
                {monthly_salary ?? hourly_pay ?? '—'}
              </span>
            )
          }
          // Show what EXISTS: prefer the salary_form's kind, but a stored amount
          // of the other kind still renders (a mismatched form must not hide a
          // real value).
          const monthly = monthly_salary
            ? formatMonthlySalary(monthly_salary)
            : null
          const hourly = hourly_pay ? formatHourlyPay(hourly_pay) : null
          const display =
            salary_form === 'TIM' ? (hourly ?? monthly) : (monthly ?? hourly)
          return display ? (
            <span className="tabular-nums">{display}</span>
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_LABEL}</span>
          )
        },
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.salary ?? 'Lön',
            nowrap: true,
            // Screen-share privacy: never surfaces on cards either — the
            // column is default-hidden and card faces respect visibility.
            card: { role: 'hidden' },
          },
        },
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
        meta: {
          dt: {
            label:
              EMPLOYEE_COLUMN_LABELS.collective_agreement ?? 'Kollektivavtal',
            nowrap: true,
            card: {
              role: 'meta',
              priority: 5,
              renderCard: (row) =>
                row.original.collective_agreement?.name ? (
                  <span className="text-sm">
                    {row.original.collective_agreement.name}
                  </span>
                ) : null,
            },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.group ?? 'Grupp',
            nowrap: true,
            card: { role: 'meta', priority: 6, interactive: true },
          },
        },
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
        meta: {
          dt: {
            label: EMPLOYEE_COLUMN_LABELS.status ?? 'Status',
            nowrap: true,
            card: { role: 'badge', priority: 0 },
          },
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

  // ---- Column-state adapter (parent-owned persistence, unchanged) ----
  const columnState = useMemo(
    () => ({
      visibility: columnVisibility,
      onVisibilityChange: (updater: Updater<VisibilityState>) =>
        onColumnVisibilityChange(
          typeof updater === 'function' ? updater(columnVisibility) : updater
        ),
      sizing: columnSizing,
      onSizingChange: onColumnSizingChange,
    }),
    [
      columnVisibility,
      columnSizing,
      onColumnVisibilityChange,
      onColumnSizingChange,
    ]
  )

  const rowInteraction = useMemo(
    () => ({ onRowClick: (row: EmployeeRow) => onRowClick(row.id) }),
    [onRowClick]
  )

  // ---- Expand/collapse-all (Task 3b, law-table placement) ----
  const handleExpandAll = useCallback(() => setCollapsed(new Set()), [])
  const handleCollapseAll = useCallback(() => {
    setCollapsed(new Set([UNGROUPED_ID, ...groups.map((g) => g.id)]))
  }, [groups])

  const handleMoveToSection = useCallback(
    async (employeeId: string, sectionId: string) => {
      const targetGroupId = sectionId === UNGROUPED_ID ? null : sectionId
      const employee = employees.find((e) => e.id === employeeId)
      if (!employee || employee.group_id === targetGroupId) return
      await onMoveToGroup(employeeId, targetGroupId)
    },
    [employees, onMoveToGroup]
  )

  const renderDragOverlay = useCallback(
    (employeeId: string) => {
      const employee = employees.find((e) => e.id === employeeId)
      if (!employee) return null
      return (
        <div className="bg-background border rounded-md p-3 shadow-lg opacity-90">
          <span className="font-medium text-sm">
            {employee.first_name} {employee.last_name}
          </span>
        </div>
      )
    },
    [employees]
  )

  // ---- Section descriptors ----
  const sections = useMemo<DataTableSection<EmployeeRow>[]>(() => {
    const makeHeader = (name: string, groupId: string, isUngrouped: boolean) =>
      // Render function invoked by GroupedDataTable (not a mounted component).
      function SectionHeader({ isDropTarget }: { isDropTarget: boolean }) {
        const counts = unfilteredCounts[groupId]
        return (
          <span className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:block">
              {isUngrouped ? (
                <FolderX className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Folder
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isDropTarget ? 'text-primary' : 'text-primary'
                  )}
                />
              )}
            </span>
            <span className="flex-1 text-left text-sm font-medium sm:text-base">
              {name}
            </span>
            {/* Unfiltered counts — group size must not change while
                searching (QA UX-001). Story 7.4: "{n}/{m} kompletta". */}
            <span className="text-xs tabular-nums text-muted-foreground">
              {!counts || counts.total === 0
                ? '0'
                : `${counts.complete}/${counts.total} kompletta`}
            </span>
          </span>
        )
      }

    const makeEmpty = (groupId: string) => {
      const unfilteredCount = unfilteredCounts[groupId]?.total ?? 0
      return (
        // QA UX-001: only a TRULY empty group (unfiltered) shows the
        // drag-here hint; a group whose rows are merely filtered out
        // says so instead of pretending to be empty.
        <p className="py-4 text-center text-sm text-muted-foreground">
          {unfilteredCount > 0
            ? 'Inga träffar i denna grupp.'
            : canManage
              ? 'Dra anställda hit.'
              : 'Inga anställda i denna grupp.'}
        </p>
      )
    }

    const list: DataTableSection<EmployeeRow>[] = groups.map((group) => ({
      id: group.id,
      items: groupedRows[group.id] ?? [],
      header: makeHeader(group.name, group.id, false),
      empty: makeEmpty(group.id),
    }))
    list.push({
      id: UNGROUPED_ID,
      items: ungroupedRows,
      header: makeHeader('Ogrupperad', UNGROUPED_ID, true),
      empty: makeEmpty(UNGROUPED_ID),
    })
    return list
  }, [groups, groupedRows, ungroupedRows, unfilteredCounts, canManage])

  // ---- Empty register (no employees at all in the workspace) ----
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

  // ---- Flat table when no groups exist ----
  if (groups.length === 0) {
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
      <DataTable<EmployeeRow>
        data={employees}
        columns={columns}
        getRowId={(row) => row.id}
        columnState={columnState}
        rowInteraction={rowInteraction}
        view={{ cardBelow: 800 }}
      />
    )
  }

  // ---- Grouped sections ----
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {employees.length} av {totalCount} anställda.
          {canManage && (
            <span className="ml-1 hidden sm:inline">
              Dra till grupprubriker för att flytta.
            </span>
          )}
        </p>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="h-8 px-2 text-xs sm:px-3"
            title="Visa alla grupper"
          >
            <ExpandIcon className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Visa alla</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="h-8 px-2 text-xs sm:px-3"
            title="Dölj alla grupper"
          >
            <MinusIcon className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Dölj alla</span>
          </Button>
        </div>
      </div>

      <GroupedDataTable<EmployeeRow>
        sections={sections}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        perSectionSorting
        columns={columns}
        getRowId={(row) => row.id}
        columnState={columnState}
        rowInteraction={rowInteraction}
        view={{ cardBelow: 800 }}
        sectionDnd={{
          enabled: dragEnabled,
          onMoveToSection: handleMoveToSection,
          renderDragOverlay,
        }}
      />
    </div>
  )
}

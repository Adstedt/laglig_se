'use client'

/**
 * Story 7.2: Personalregister client island — status tabs, client-side
 * search, `?anstalld=` URL param wiring and the grouped employee table.
 *
 * Story 7.3: mounts the Personalkort modal on the `?anstalld=` state
 * (`'ny'` = create mode). Edit prefill comes from the already-loaded rows —
 * a stale/foreign id yields a toast + param clear (never a client-side
 * server-helper call). `onEmployeeChange` applies the optimistic
 * insert/update to the island's row state (law-list modal pattern).
 *
 * Story 7.4: owns the `PageHeader` too (moved from the server page) so the
 * "Kompletta" stat derives from the island's UNFILTERED row state (7.2's
 * UX-001 lesson: filters must never change global counts) and updates
 * optimistically after Personalkort saves. Adds the "Ej kompletta" tab —
 * completeness is orthogonal to Aktiv/Inaktiv.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  ColumnSizingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import {
  CircleAlert,
  Search,
  TriangleAlert,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  WorkspaceViewTabs,
  WorkspaceViewTabsList,
  WorkspaceViewTabsTrigger,
} from '@/components/ui/workspace-view-tabs'
import { toast } from 'sonner'
import {
  moveEmployeeToGroup,
  type EmployeeGroupSummary,
} from '@/app/actions/employees'
import { assessEmployeeCompleteness } from '@/lib/employees/employee-completeness'
import { KollektivavtalManagerDialog } from '@/components/features/kollektivavtal/kollektivavtal-manager-dialog'
import type { EmployeeRow } from './employee-row'
import { filterEmployees, type EmployeeStatusTab } from './filter-employees'
import { EmployeeListTable } from './employee-list-table'
import { EmployeeColumnSettings } from './employee-column-settings'
import {
  clampEmployeeColumnSizing,
  defaultEmployeeColumnState,
  loadEmployeeColumnState,
  sanitizeEmployeeColumnVisibility,
  saveEmployeeColumnState,
  type EmployeeColumnState,
} from './employee-column-state'
import { ManageGroupsPopover } from './manage-groups-popover'
import { PersonalkortModal } from './personalkort-modal'
import { NEW_EMPLOYEE_SENTINEL, useAnstalldParam } from './use-anstalld-param'

/** Keep optimistic inserts in the server's ordering (last_name, first_name). */
function sortRows(rows: EmployeeRow[]): EmployeeRow[] {
  return [...rows].sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name, 'sv') ||
      a.first_name.localeCompare(b.first_name, 'sv')
  )
}

interface PersonalregisterContentProps {
  initialRows: EmployeeRow[]
  groups: EmployeeGroupSummary[]
  canManage: boolean
  /** True when the server page failed to load groups (QA REL-001). */
  groupsLoadFailed?: boolean
  /**
   * Story 7.4: `CompanyProfile.has_collective_agreement` — drives the
   * kollektivavtal criterion of the completeness rule. False when the
   * profile is missing.
   */
  workspaceHasCollectiveAgreement?: boolean
  /** Server-supplied primaryAction node for the island-owned PageHeader. */
  headerPrimaryAction?: ReactNode
}

export function PersonalregisterContent({
  initialRows,
  groups,
  canManage,
  groupsLoadFailed = false,
  workspaceHasCollectiveAgreement = false,
  headerPrimaryAction,
}: PersonalregisterContentProps) {
  const [tab, setTab] = useState<EmployeeStatusTab>('alla')
  const [search, setSearch] = useState('')

  // Local copy of the rows for optimistic group moves; re-synced whenever the
  // server page re-renders (every group mutation revalidates the route).
  const [rows, setRows] = useState<EmployeeRow[]>(initialRows)
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  // --------------------------------------------------------------------
  // Column show/hide + resize state (Story 7.4b + 7.10). Lifted here from
  // `EmployeeListTable` (user-checkpoint layout round) so the "Kolumner"
  // control lives in the content-island toolbar next to Kollektivavtal and
  // Hantera grupper; the table is now a CONTROLLED consumer of this state.
  // The workspace id comes off the rows themselves (every EmployeeRow is
  // workspace-scoped) — an empty register has no rows and nothing worth
  // persisting, so persistence is simply skipped then.
  // --------------------------------------------------------------------
  const workspaceId = rows[0]?.workspace_id ?? null
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

  // --------------------------------------------------------------------
  // `?anstalld=` URL param + Personalkort modal (Story 7.3).
  // Open/close/sync logic lives in useAnstalldParam (DocumentListPageContent
  // `?document=` pattern); `'ny'` is the reserved create-mode sentinel.
  // --------------------------------------------------------------------
  const {
    selectedEmployeeId,
    openEmployee: handleOpenEmployee,
    closeEmployee,
  } = useAnstalldParam()

  // Edit prefill comes from the already-loaded rows — a stale/foreign
  // `?anstalld=` id (old link, other workspace) is cleared with a toast.
  // Never call server helpers from the client for this.
  const selectedRow =
    selectedEmployeeId && selectedEmployeeId !== NEW_EMPLOYEE_SENTINEL
      ? (rows.find((row) => row.id === selectedEmployeeId) ?? null)
      : null

  useEffect(() => {
    if (!selectedEmployeeId || selectedEmployeeId === NEW_EMPLOYEE_SENTINEL) {
      return
    }
    if (!rows.some((row) => row.id === selectedEmployeeId)) {
      toast.error('Anställd hittades inte')
      closeEmployee()
    }
  }, [selectedEmployeeId, rows, closeEmployee])

  // Optimistic insert/update from the Personalkort modal (Story 7.3) —
  // mirrors the law-list modal's lifted onListItemChange pattern. The row is
  // the action's sanitized serialized return value.
  const handleEmployeeChange = useCallback(
    (row: EmployeeRow, mode: 'created' | 'updated') => {
      setRows((current) =>
        mode === 'created'
          ? sortRows([...current, row])
          : current.map((existing) => (existing.id === row.id ? row : existing))
      )
    },
    []
  )

  // --------------------------------------------------------------------
  // Group moves (drag + inline select) with optimistic local update.
  // Rollback is PER ROW (QA REL-002): a failed move restores only the moved
  // employee's previous group, so other in-flight/persisted moves survive.
  // --------------------------------------------------------------------
  const handleMoveToGroup = useCallback(
    async (employeeId: string, groupId: string | null): Promise<boolean> => {
      const previousRow = rows.find((row) => row.id === employeeId)
      if (!previousRow) return false
      const previousGroupId = previousRow.group_id
      const previousGroup = previousRow.group

      const groupName = groupId
        ? (groups.find((g) => g.id === groupId)?.name ?? null)
        : null

      setRows((current) =>
        current.map((row) =>
          row.id === employeeId
            ? {
                ...row,
                group_id: groupId,
                group:
                  groupId && groupName
                    ? { id: groupId, name: groupName }
                    : null,
              }
            : row
        )
      )

      const result = await moveEmployeeToGroup(employeeId, groupId)
      if (!result.success) {
        // Restore only the affected row — never a whole-array snapshot.
        setRows((current) =>
          current.map((row) =>
            row.id === employeeId
              ? { ...row, group_id: previousGroupId, group: previousGroup }
              : row
          )
        )
        toast.error(result.error ?? 'Kunde inte flytta den anställda.')
        return false
      }
      return true
    },
    [groups, rows]
  )

  const filteredRows = useMemo(
    () =>
      filterEmployees(rows, { tab, search, workspaceHasCollectiveAgreement }),
    [rows, tab, search, workspaceHasCollectiveAgreement]
  )

  // Story 7.4: header stat from UNFILTERED row state (never filteredRows —
  // 7.2's UX-001). Recomputes when `onEmployeeChange` applies a save.
  const completeCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          assessEmployeeCompleteness(row, { workspaceHasCollectiveAgreement })
            .complete
      ).length,
    [rows, workspaceHasCollectiveAgreement]
  )

  return (
    <div className="space-y-2">
      <PageHeader
        title="Personalregister"
        subtitle="Se och hantera alla anställda på ett ställe."
        primaryAction={headerPrimaryAction}
        // "8/11" reads as counts of employees with complete uppgifter — the
        // noun "kompletthet" is banned copy; the label stays the adjective.
        {...(rows.length > 0
          ? {
              stats: [
                {
                  label: 'Kompletta',
                  value: `${completeCount}/${rows.length}`,
                },
              ],
            }
          : {})}
      />

      <div className="space-y-4">
        {groupsLoadFailed && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Grupper kunde inte laddas. Anställda visas utan gruppering.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <WorkspaceViewTabs
            value={tab}
            onValueChange={(value) => setTab(value as EmployeeStatusTab)}
          >
            <WorkspaceViewTabsList>
              <WorkspaceViewTabsTrigger value="alla">
                <Users className="h-4 w-4" />
                Alla
              </WorkspaceViewTabsTrigger>
              <WorkspaceViewTabsTrigger value="aktiva">
                <UserCheck className="h-4 w-4" />
                Aktiva
              </WorkspaceViewTabsTrigger>
              <WorkspaceViewTabsTrigger value="ej_kompletta">
                <CircleAlert className="h-4 w-4" />
                Ej kompletta
              </WorkspaceViewTabsTrigger>
              <WorkspaceViewTabsTrigger value="inaktiva">
                <UserX className="h-4 w-4" />
                Inaktiva
              </WorkspaceViewTabsTrigger>
            </WorkspaceViewTabsList>
          </WorkspaceViewTabs>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök namn, personnummer, ID…"
                className="h-9 w-full pl-8 sm:w-64"
                aria-label="Sök anställda"
              />
            </div>

            {/* Checkpoint round (7.6): kollektivavtal management/Tilldela must
                be reachable from the register, not only Settings. Shown for
                all viewers — the manager itself renders view-only without
                `employees:manage` and every mutation is server-gated. */}
            <KollektivavtalManagerDialog canManage={canManage} />

            {canManage && <ManageGroupsPopover groups={groups} />}

            {/* User-checkpoint layout round: "Kolumner" lives here so
                Kollektivavtal, Hantera grupper and Kolumner share one toolbar
                row. Shown for all viewers (visibility is display-only; the
                repository already gates privileged values server-side). */}
            <EmployeeColumnSettings
              columnVisibility={columnState.visibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
            />
          </div>
        </div>

        <EmployeeListTable
          employees={filteredRows}
          allEmployees={rows}
          groups={groups}
          canManage={canManage}
          totalCount={rows.length}
          workspaceHasCollectiveAgreement={workspaceHasCollectiveAgreement}
          columnVisibility={columnState.visibility}
          columnSizing={columnState.sizing}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onColumnSizingChange={handleColumnSizingChange}
          onRowClick={handleOpenEmployee}
          onMoveToGroup={handleMoveToGroup}
          onAddEmployee={
            canManage
              ? () => handleOpenEmployee(NEW_EMPLOYEE_SENTINEL)
              : undefined
          }
        />

        <PersonalkortModal
          anstalldId={selectedEmployeeId}
          row={selectedRow}
          employees={rows}
          canManage={canManage}
          workspaceHasCollectiveAgreement={workspaceHasCollectiveAgreement}
          onClose={closeEmployee}
          onEmployeeChange={handleEmployeeChange}
        />
      </div>
    </div>
  )
}

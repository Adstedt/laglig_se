'use client'

/**
 * Story 7.3: Personalkort — create & edit employee modal.
 *
 * Composition over the canonical `SplitPanelModal` shell (the same primitive
 * behind LegalDocumentModal) — NOT a new dialog. Controlled dumb component:
 * the register island owns the `?anstalld=` URL param via `useAnstalldParam`
 * (7.2) and passes `anstalldId`/`onClose`; this component never touches the
 * URL.
 *
 *  - `anstalldId === 'ny'` → create mode (empty form).
 *  - Edit prefill comes from the already-loaded register row (no refetch).
 *  - No `renderChat`/`renderRail`/`banner` — the employee-aware AI chat is
 *    Story 7.7.
 *  - `employees:view`-only roles get a read-only form (server actions remain
 *    the real permission boundary).
 */

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { SplitPanelModal } from '@/components/shared/split-panel-modal'
import { Button } from '@/components/ui/button'
import {
  getCollectiveAgreements,
  type CollectiveAgreementOption,
} from '@/app/actions/employees'
import { assessEmployeeCompleteness } from '@/lib/employees/employee-completeness'
import type { EmployeeRow } from '../employee-row'
import { NEW_EMPLOYEE_SENTINEL } from '../use-anstalld-param'
import { PersonalkortForm } from './personalkort-form'
import { ComplianceSidebar } from './compliance-sidebar'

export interface PersonalkortModalProps {
  /** `?anstalld=` value: employee id, `'ny'` (create) or null (closed). */
  anstalldId: string | null
  /** Register row for edit prefill; null in create mode (or while stale). */
  row: EmployeeRow | null
  /** All register rows — source for the manager select. */
  employees: EmployeeRow[]
  canManage: boolean
  /**
   * Story 7.4: workspace kollektivavtal flag for the completeness rule
   * behind the sidebar's "uppgifter saknas" reasons. Defaults to false
   * (no kollektivavtal requirement).
   */
  workspaceHasCollectiveAgreement?: boolean
  onClose: () => void
  onEmployeeChange: (_row: EmployeeRow, _mode: 'created' | 'updated') => void
}

export function PersonalkortModal({
  anstalldId,
  row,
  employees,
  canManage,
  workspaceHasCollectiveAgreement = false,
  onClose,
  onEmployeeChange,
}: PersonalkortModalProps) {
  const open = anstalldId !== null
  const isCreate = anstalldId === NEW_EMPLOYEE_SENTINEL

  // Kollektivavtal options are fetched on open (gated employees:view). A
  // FAILED fetch is tracked separately (QA UX-001): the form shows a muted
  // "kunde inte laddas" hint with a disabled select — never the empty-state
  // upload placeholder, which would imply no agreements exist. The modal is
  // never blocked either way.
  const [agreements, setAgreements] = useState<
    CollectiveAgreementOption[] | null
  >(null)
  const [agreementsFailed, setAgreementsFailed] = useState(false)

  // Story 7.5: also re-run after an upload from the form's empty-state
  // affordance, so the new agreement is immediately selectable.
  const loadAgreements = useCallback(() => {
    let cancelled = false
    setAgreements(null)
    setAgreementsFailed(false)
    getCollectiveAgreements()
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setAgreements(result.data ?? [])
        } else {
          setAgreementsFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setAgreementsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    return loadAgreements()
  }, [open, loadAgreements])

  // Stale/foreign ids are handled by the island (toast + param clear) —
  // render nothing while that effect settles.
  if (open && !isCreate && !row) return null

  const title = isCreate
    ? 'Ny anställd'
    : row
      ? `${row.first_name} ${row.last_name}`.trim()
      : 'Anställd'

  return (
    <SplitPanelModal
      open={open}
      onClose={onClose}
      srTitle={title}
      header={
        <div className="flex items-center justify-between border-b px-6 py-3 bg-background shrink-0">
          {/* Chrome shows CONTEXT (like the law modal's breadcrumb); the
              entity identity lives in the left panel's Safiro header — showing
              the title in both duplicated "Ny anställd" (user checkpoint). */}
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            Personalregister
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-4 h-8 shrink-0 px-2"
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      }
      leftPanel={
        // The form owns the left panel: fields scroll in its ScrollArea
        // (law-modal overflow guards, DESIGN-005) while the action footer
        // stays pinned below the scroll region (DESIGN-004).
        open ? (
          <PersonalkortForm
            key={anstalldId}
            mode={isCreate ? 'create' : 'edit'}
            row={isCreate ? null : row}
            employees={employees}
            agreements={agreements}
            agreementsFailed={agreementsFailed}
            onAgreementUploaded={loadAgreements}
            readOnly={!canManage}
            onSaved={onEmployeeChange}
            onClose={onClose}
          />
        ) : null
      }
      rightPanel={
        <ComplianceSidebar
          inactive={!isCreate && row ? row.inactive : false}
          agreementName={
            !isCreate && row ? (row.collective_agreement?.name ?? null) : null
          }
          // Story 7.4: reasons computed from the SAVED row when the modal
          // opens (the modal closes after save in both modes, so they can
          // never go stale mid-session); null in create mode — no record
          // to assess yet.
          completeness={
            !isCreate && row
              ? assessEmployeeCompleteness(row, {
                  workspaceHasCollectiveAgreement,
                })
              : null
          }
        />
      }
    />
  )
}

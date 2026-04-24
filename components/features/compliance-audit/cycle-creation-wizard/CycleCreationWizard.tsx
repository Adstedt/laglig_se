'use client'

/**
 * Story 21.4 — cycle creation wizard orchestrator.
 *
 * Three-step flow: metadata → scope → confirm → submit (createCycle + materialiseCycleItems).
 * On success: redirects to /laglistor/kontroller/{cycleId} (Story 21.5's detail route).
 *
 * Concurrency defence (Story 21.4 Dev Notes "Double-submit / concurrency protection"):
 *  1. Client-side `submit: 'submitting'` disables the button during the two-call sequence.
 *  2. Server PLANERAD status guard in materialiseCycleItems.
 *  3. DB-level @@unique([cycle_id, law_list_item_id]) — belt-and-braces for race wins.
 */

import { useCallback, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { AuditType } from '@prisma/client'
import {
  createCycle,
  materialiseCycleItems,
  softDeleteCycle,
  type ScopeDefinition,
} from '@/app/actions/compliance-audit-cycle'
import type {
  DocumentListSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import { CycleMetadataStep } from './CycleMetadataStep'
import { CycleScopeStep } from './CycleScopeStep'
import { CycleConfirmStep, type SubmitState } from './CycleConfirmStep'
import type { CycleMetadata, CycleMetadataErrors } from './types'

export interface CycleCreationWizardProps {
  lawLists: DocumentListSummary[]
  members: WorkspaceMemberOption[]
}

type WizardState =
  | {
      step: 1
      metadata: Partial<CycleMetadata>
      scope: null
      errors: CycleMetadataErrors
    }
  | {
      step: 2
      metadata: CycleMetadata
      scope: ScopeDefinition | null
      errors: CycleMetadataErrors
    }
  | {
      step: 3
      metadata: CycleMetadata
      scope: ScopeDefinition
      errors: CycleMetadataErrors
      submit: SubmitState
      cycleId?: string
      errorMessage?: string
    }

type WizardAction =
  | { type: 'metadata-change'; patch: Partial<CycleMetadata> }
  | { type: 'metadata-errors'; errors: CycleMetadataErrors }
  | { type: 'go-to-scope'; metadata: CycleMetadata }
  | { type: 'scope-change'; scope: ScopeDefinition }
  | { type: 'go-back-to-metadata' }
  | { type: 'go-to-confirm' }
  | { type: 'go-back-to-scope' }
  | { type: 'submit-start' }
  | { type: 'submit-create-error'; errorMessage: string }
  | {
      type: 'submit-materialise-error'
      cycleId: string
      errorMessage: string
      emptyScope: boolean
    }
  | { type: 'submit-success' }
  | { type: 'discard-and-restart-to-scope'; metadata: CycleMetadata }

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'metadata-change': {
      if (state.step === 1) {
        return {
          step: 1,
          metadata: { ...state.metadata, ...action.patch },
          scope: null,
          errors: state.errors,
        }
      }
      if (state.step === 2) {
        return {
          step: 2,
          metadata: { ...state.metadata, ...action.patch } as CycleMetadata,
          scope: state.scope,
          errors: state.errors,
        }
      }
      return state
    }
    case 'metadata-errors': {
      return { ...state, errors: action.errors }
    }
    case 'go-to-scope': {
      // If we already had a scope and the lawListId changed, clear scope.
      const prevScope =
        state.step === 2 &&
        state.metadata.lawListId === action.metadata.lawListId
          ? state.scope
          : null
      const next: WizardState = {
        step: 2,
        metadata: action.metadata,
        scope: prevScope,
        errors: {},
      }
      return next
    }
    case 'scope-change': {
      if (state.step !== 2) return state
      return { ...state, scope: action.scope }
    }
    case 'go-back-to-metadata': {
      if (state.step !== 2 && state.step !== 3) return state
      return {
        step: 1,
        metadata: state.metadata,
        scope: null,
        errors: {},
      }
    }
    case 'go-to-confirm': {
      if (state.step !== 2 || state.scope === null) return state
      return {
        step: 3,
        metadata: state.metadata,
        scope: state.scope,
        errors: state.errors,
        submit: 'idle',
      }
    }
    case 'go-back-to-scope': {
      if (state.step !== 3) return state
      return {
        step: 2,
        metadata: state.metadata,
        scope: state.scope,
        errors: {},
      }
    }
    case 'submit-start': {
      if (state.step !== 3) return state
      const next: WizardState = {
        step: 3,
        metadata: state.metadata,
        scope: state.scope,
        errors: state.errors,
        submit: 'submitting',
      }
      if (state.cycleId !== undefined) next.cycleId = state.cycleId
      return next
    }
    case 'submit-create-error': {
      if (state.step !== 3) return state
      return {
        step: 3,
        metadata: state.metadata,
        scope: state.scope,
        errors: state.errors,
        submit: 'error-create',
        errorMessage: action.errorMessage,
      }
    }
    case 'submit-materialise-error': {
      if (state.step !== 3) return state
      return {
        step: 3,
        metadata: state.metadata,
        scope: state.scope,
        errors: state.errors,
        submit: action.emptyScope
          ? 'error-materialise-empty-scope'
          : 'error-materialise',
        cycleId: action.cycleId,
        errorMessage: action.errorMessage,
      }
    }
    case 'submit-success': {
      if (state.step !== 3) return state
      const next: WizardState = {
        step: 3,
        metadata: state.metadata,
        scope: state.scope,
        errors: state.errors,
        submit: 'success',
      }
      if (state.cycleId !== undefined) next.cycleId = state.cycleId
      return next
    }
    case 'discard-and-restart-to-scope': {
      // Keep metadata, clear scope + cycleId, go back to Step 2.
      return {
        step: 2,
        metadata: action.metadata,
        scope: null,
        errors: {},
      }
    }
  }
}

const INITIAL_STATE: WizardState = {
  step: 1,
  metadata: { auditType: AuditType.INTERN },
  scope: null,
  errors: {},
}

function validateMetadata(m: Partial<CycleMetadata>): CycleMetadataErrors {
  const errors: CycleMetadataErrors = {}
  if (!m.name || !m.name.trim()) {
    errors.name = 'Namn krävs'
  } else if (m.name.length > 200) {
    errors.name = 'Max 200 tecken'
  }
  if (m.scheduledStart && m.scheduledEnd) {
    if (new Date(m.scheduledEnd) < new Date(m.scheduledStart)) {
      errors.scheduledEnd =
        'Slutdatum måste vara lika med eller efter startdatum'
    }
  }
  return errors
}

function isCompleteMetadata(m: Partial<CycleMetadata>): m is CycleMetadata {
  return Boolean(
    m.name &&
      m.lawListId &&
      m.auditType &&
      m.scheduledStart &&
      m.scheduledEnd &&
      m.lawChangeCutoffDate &&
      m.leadAuditorUserId
  )
}

export function CycleCreationWizard({
  lawLists,
  members,
}: CycleCreationWizardProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const handleMetadataChange = useCallback((patch: Partial<CycleMetadata>) => {
    dispatch({ type: 'metadata-change', patch })
  }, [])

  const handleMetadataNext = useCallback(() => {
    const errors = validateMetadata(state.metadata)
    if (Object.keys(errors).length > 0 || !isCompleteMetadata(state.metadata)) {
      dispatch({ type: 'metadata-errors', errors })
      return
    }
    dispatch({ type: 'go-to-scope', metadata: state.metadata })
  }, [state.metadata])

  const handleScopeChange = useCallback((scope: ScopeDefinition) => {
    dispatch({ type: 'scope-change', scope })
  }, [])

  const handleScopeNext = useCallback(() => {
    dispatch({ type: 'go-to-confirm' })
  }, [])

  const handleBackToMetadata = useCallback(() => {
    dispatch({ type: 'go-back-to-metadata' })
  }, [])

  const handleBackToScope = useCallback(() => {
    dispatch({ type: 'go-back-to-scope' })
  }, [])

  // ------ Submit flow --------------------------------------------------------

  const doMaterialise = useCallback(
    async (cycleId: string) => {
      const res = await materialiseCycleItems(cycleId)
      if (!res.success) {
        const emptyScope = res.error === 'Omfattningen matchar inga dokument'
        dispatch({
          type: 'submit-materialise-error',
          cycleId,
          errorMessage: emptyScope
            ? res.error!
            : (res.error ??
              'Kontrollen skapades men dokumenten kunde inte förberedas. Försök igen.'),
          emptyScope,
        })
        return
      }
      dispatch({ type: 'submit-success' })
      router.push(`/laglistor/kontroller/${cycleId}`)
    },
    [router]
  )

  const handleSubmit = useCallback(async () => {
    if (state.step !== 3) return
    dispatch({ type: 'submit-start' })

    const createResult = await createCycle({
      lawListId: state.metadata.lawListId,
      name: state.metadata.name,
      auditType: state.metadata.auditType,
      scheduledStart: state.metadata.scheduledStart,
      scheduledEnd: state.metadata.scheduledEnd,
      lawChangeCutoffDate: state.metadata.lawChangeCutoffDate,
      leadAuditorUserId: state.metadata.leadAuditorUserId,
      scopeDefinition: state.scope,
    })

    if (!createResult.success || !createResult.data) {
      dispatch({
        type: 'submit-create-error',
        errorMessage: createResult.error ?? 'Kunde inte skapa kontrollen',
      })
      return
    }

    await doMaterialise(createResult.data.cycle.id)
  }, [state, doMaterialise])

  const handleRetryMaterialise = useCallback(async () => {
    if (state.step !== 3 || !state.cycleId) return
    dispatch({ type: 'submit-start' })
    await doMaterialise(state.cycleId)
  }, [state, doMaterialise])

  const handleDiscardAndRestart = useCallback(async () => {
    if (state.step !== 3 || !state.cycleId) return
    const res = await softDeleteCycle(state.cycleId)
    if (!res.success) {
      // Stay on Step 3 with the error visible; both buttons remain available.
      dispatch({
        type: 'submit-materialise-error',
        cycleId: state.cycleId,
        errorMessage: res.error ?? 'Kunde inte ta bort kontrollen',
        emptyScope: true,
      })
      return
    }
    dispatch({
      type: 'discard-and-restart-to-scope',
      metadata: state.metadata,
    })
  }, [state])

  // Compute the chosen laglista + its total item count for Step 3 summary.
  const chosenList = lawLists.find((l) => l.id === state.metadata.lawListId)
  const totalItemCount = chosenList?.itemCount ?? 0
  const listName = chosenList?.name ?? ''

  return (
    <div className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        Steg {state.step} av 3
      </div>

      {state.step === 1 ? (
        <CycleMetadataStep
          value={state.metadata}
          errors={state.errors}
          lawLists={lawLists}
          members={members}
          onChange={handleMetadataChange}
          onNext={handleMetadataNext}
        />
      ) : null}

      {state.step === 2 ? (
        <CycleScopeStep
          lawListId={state.metadata.lawListId}
          value={state.scope}
          onChange={handleScopeChange}
          onBack={handleBackToMetadata}
          onNext={handleScopeNext}
        />
      ) : null}

      {state.step === 3 ? (
        <CycleConfirmStep
          metadata={state.metadata}
          scope={state.scope}
          listName={listName}
          totalItemCount={totalItemCount}
          submitState={state.submit}
          {...(state.errorMessage !== undefined
            ? { errorMessage: state.errorMessage }
            : {})}
          members={members}
          onSubmit={handleSubmit}
          onRetryMaterialise={handleRetryMaterialise}
          onDiscardAndRestart={handleDiscardAndRestart}
          onBack={handleBackToScope}
        />
      ) : null}
    </div>
  )
}

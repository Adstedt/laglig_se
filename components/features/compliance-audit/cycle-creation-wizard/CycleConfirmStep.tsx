'use client'

/** Story 21.4 — cycle creation wizard, Step 3 (confirm + submit). */

import { Loader2 } from 'lucide-react'
import { AuditType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import {
  scopeSummaryAll,
  scopeSummaryItems,
} from '@/components/features/compliance-audit/scope-summary-copy'
import type { CycleMetadata } from './types'

export type SubmitState =
  | 'idle'
  | 'submitting'
  | 'error-create'
  | 'error-materialise'
  | 'error-materialise-empty-scope'
  | 'success'

export interface CycleConfirmStepProps {
  metadata: CycleMetadata
  scope: ScopeDefinition
  listName: string
  totalItemCount: number
  submitState: SubmitState
  errorMessage?: string
  members: WorkspaceMemberOption[]
  onSubmit: () => void
  onRetryMaterialise: () => void
  onDiscardAndRestart: () => void
  onBack: () => void
}

/**
 * Story 21.4 NH-3: ScopeDefinition-keyed cycle-confirmation summary.
 *
 * Reuses shared Swedish copy constants so it cannot drift from ScopeSelector's
 * live summary (both surfaces import from `scope-summary-copy.ts`).
 *
 * Note on `kind: 'groups'`: the confirmation step knows the group count but
 * NOT the per-group item count (ScopeSelector's onChange emits only groupIds).
 * Rather than re-fetching + re-counting here, we state the group count plainly
 * and let the final itemCount appear post-materialisation (activity-log + 21.5
 * detail view). This is intentional — avoids a redundant server round-trip for
 * a value the user just saw in the ScopeSelector's live summary on Step 2.
 */
export function formatCycleScopeSummary(
  scope: ScopeDefinition,
  totalItemCount: number
): string {
  if (scope.kind === 'all') return scopeSummaryAll(totalItemCount)
  if (scope.kind === 'groups') {
    const g = scope.groupIds.length
    return `${g} ${g === 1 ? 'grupp vald' : 'grupper valda'}`
  }
  return scopeSummaryItems(scope.itemIds.length)
}

const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  INTERN: 'Intern revision',
  EXTERN: 'Extern revision',
}

export function CycleConfirmStep({
  metadata,
  scope,
  listName,
  totalItemCount,
  submitState,
  errorMessage,
  members,
  onSubmit,
  onRetryMaterialise,
  onDiscardAndRestart,
  onBack,
}: CycleConfirmStepProps) {
  const submitting = submitState === 'submitting'
  const leadAuditor = members.find((m) => m.id === metadata.leadAuditorUserId)
  const scopeSummary = formatCycleScopeSummary(scope, totalItemCount)

  const isEmptyScopeError = submitState === 'error-materialise-empty-scope'
  const isMaterialiseError = submitState === 'error-materialise'
  const isCreateError = submitState === 'error-create'

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Omfattning
        </h2>
        <p className="text-sm text-foreground">
          <span className="font-medium">{listName}</span> — {scopeSummary}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Detaljer</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Namn</dt>
          <dd>{metadata.name}</dd>

          <dt className="text-muted-foreground">Revisionstyp</dt>
          <dd>{AUDIT_TYPE_LABELS[metadata.auditType]}</dd>

          <dt className="text-muted-foreground">Period</dt>
          <dd>
            {metadata.scheduledStart} – {metadata.scheduledEnd}
          </dd>

          <dt className="text-muted-foreground">Brytdatum</dt>
          <dd>{metadata.lawChangeCutoffDate}</dd>

          <dt className="text-muted-foreground">Ansvarig revisor</dt>
          <dd>{leadAuditor?.name ?? leadAuditor?.email ?? '—'}</dd>
        </dl>
      </section>

      {(isCreateError || isMaterialiseError || isEmptyScopeError) &&
      errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription role="alert">{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
        >
          Tillbaka
        </Button>
        <div className="flex gap-2">
          {isEmptyScopeError ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onDiscardAndRestart}
              >
                Ta bort och börja om
              </Button>
              <Button type="button" onClick={onRetryMaterialise}>
                Försök igen
              </Button>
            </>
          ) : isMaterialiseError ? (
            <Button type="button" onClick={onRetryMaterialise}>
              Försök igen
            </Button>
          ) : isCreateError ? (
            <Button type="button" onClick={onSubmit}>
              Försök igen
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Skapar…
                </>
              ) : (
                'Skapa kontroll'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

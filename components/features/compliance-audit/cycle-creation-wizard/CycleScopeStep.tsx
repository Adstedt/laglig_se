'use client'

/** Story 21.4 — cycle creation wizard, Step 2 (scope selection). */

import { Button } from '@/components/ui/button'
import { ScopeSelector } from '@/components/features/compliance-audit/scope-selector'
import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'

export interface CycleScopeStepProps {
  lawListId: string
  value: ScopeDefinition | null
  onChange: (_scope: ScopeDefinition) => void
  onBack: () => void
  onNext: () => void
}

export function CycleScopeStep({
  lawListId,
  value,
  onChange,
  onBack,
  onNext,
}: CycleScopeStepProps) {
  return (
    <div className="space-y-4">
      <ScopeSelector
        listId={lawListId}
        {...(value !== null ? { value } : {})}
        onChange={onChange}
        defaultCollapsed
      />
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Tillbaka
        </Button>
        <Button type="button" onClick={onNext} disabled={value === null}>
          Nästa
        </Button>
      </div>
    </div>
  )
}

'use client'

/**
 * Story 14.10, Task 5: Assessment Resolution UI
 * Inline component rendered in the chat message scroll area.
 * Two states: editable form → read-only completion summary.
 *
 * Story 14.15b: Refactored to use shared useAssessmentForm hook.
 */

import { Check, Loader2, Pencil, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAssessmentForm } from '@/lib/hooks/use-assessment-form'
import type { AssessmentRecommendation } from '@/lib/changes/assessment-preview'
import { cn } from '@/lib/utils'
import type { AssessmentStatus, ImpactLevel } from '@prisma/client'

// ---------------------------------------------------------------------------
// Swedish labels (exported for reuse by assessment-detail.tsx)
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS: { value: AssessmentStatus; label: string }[] = [
  { value: 'REVIEWED', label: 'Granskad' },
  { value: 'ACTION_REQUIRED', label: 'Åtgärd krävs' },
  { value: 'NOT_APPLICABLE', label: 'Ej tillämplig' },
  { value: 'DEFERRED', label: 'Uppskjuten' },
]

export const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'HIGH', label: 'Hög' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'LOW', label: 'Låg' },
  { value: 'NONE', label: 'Ingen' },
]

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  REVIEWED: 'Granskad',
  ACTION_REQUIRED: 'Åtgärd krävs',
  NOT_APPLICABLE: 'Ej tillämplig',
  DEFERRED: 'Uppskjuten',
}

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  HIGH: 'Hög',
  MEDIUM: 'Medel',
  LOW: 'Låg',
  NONE: 'Ingen',
}

export const STATUS_VARIANT: Record<
  AssessmentStatus,
  'default' | 'destructive' | 'secondary' | 'outline'
> = {
  REVIEWED: 'default',
  ACTION_REQUIRED: 'destructive',
  NOT_APPLICABLE: 'secondary',
  DEFERRED: 'outline',
}

// ---------------------------------------------------------------------------
// Shared AI-suggestion banner (reused by assessment-detail.tsx sidebar)
// ---------------------------------------------------------------------------

export function AiSuggestionHint() {
  return (
    <div className="ai-suggest-banner flex items-start gap-2 rounded-lg px-2.5 py-1.5">
      <Sparkles className="ai-suggest-icon h-3.5 w-3.5 shrink-0 mt-[1px]" />
      <span className="text-[11px] leading-relaxed text-foreground/80">
        <span className="font-medium text-foreground">Förifyllt av AI</span> —
        granska och justera innan du sparar.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssessmentResolutionProps {
  changeEventId: string
  lawListItemId: string
  /** Agent's proposed assessment (from a save_assessment preview) — pre-fills
   *  the form and is shown as an AI suggestion until the user saves. */
  recommendation?: AssessmentRecommendation | null
  onComplete?: (() => void) | undefined
  onClose?: (() => void) | undefined
}

export function AssessmentResolution({
  changeEventId,
  lawListItemId,
  recommendation,
  onComplete,
  onClose,
}: AssessmentResolutionProps) {
  const form = useAssessmentForm({
    changeEventId,
    lawListItemId,
    ...(recommendation && {
      initial: {
        status: recommendation.status,
        impactLevel: recommendation.impactLevel,
        userNotes: recommendation.notes ?? '',
      },
    }),
    ...(onComplete && { onComplete }),
  })
  // Show the AI-suggestion hint while the pre-filled proposal is unsaved. Once a
  // saved assessment loads (form.isCompleted), the completion summary renders
  // instead, so the hint never competes with a committed decision.
  const isAiSuggested = !!recommendation && !form.isCompleted

  // ----- Completion state -----
  if (form.isCompleted && form.assessment) {
    return (
      <div className="relative mx-1 mt-4 overflow-hidden rounded-xl bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.025)] ring-1 ring-border/45">
        <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
        <div className="space-y-3 py-4 pl-5 pr-4">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.04em]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-safiro font-medium text-foreground">
              Bedömning sparad
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {new Date(form.assessment.assessedAt).toLocaleDateString(
                'sv-SE',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-muted-foreground block mb-1">
                Status
              </span>
              <Badge variant={STATUS_VARIANT[form.assessment.status]}>
                {STATUS_LABELS[form.assessment.status]}
              </Badge>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block mb-1">
                Påverkan
              </span>
              <span className="text-sm font-medium">
                {IMPACT_LABELS[form.assessment.impactLevel]}
              </span>
            </div>
          </div>
          {form.assessment.userNotes && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {form.assessment.userNotes}
            </p>
          )}
          <div className="flex items-center gap-1 pt-0.5">
            {onClose && (
              <Button
                size="sm"
                onClick={onClose}
                className="h-8 gap-1.5 rounded-md"
              >
                <Check className="h-3.5 w-3.5" />
                Klar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={form.startEditing}
              className="h-8 gap-1.5 rounded-md"
            >
              <Pencil className="h-3.5 w-3.5" />
              Ändra
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ----- Editing / new state -----
  return (
    <div
      className={cn(
        'relative mx-1 mt-4 overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.025)]',
        isAiSuggested
          ? 'ai-suggest-surface'
          : 'bg-card/70 ring-1 ring-border/45'
      )}
    >
      <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
      <div className="space-y-3 py-4 pl-5 pr-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.04em]">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-safiro font-medium text-foreground">
            Din bedömning
          </span>
        </div>
        {isAiSuggested && <AiSuggestionHint />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[11px] text-muted-foreground block mb-1">
              Status
            </span>
            <Select
              value={form.status}
              onValueChange={(v) => form.setStatus(v as AssessmentStatus)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground block mb-1">
              Påverkan
            </span>
            <Select
              value={form.impactLevel}
              onValueChange={(v) => form.setImpactLevel(v as ImpactLevel)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPACT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Textarea
          placeholder="Anteckningar (valfritt)..."
          value={form.userNotes}
          onChange={(e) => form.setUserNotes(e.target.value)}
          className="text-sm min-h-[60px] resize-none"
        />

        <div className="flex items-center gap-1 pt-0.5">
          <Button
            size="sm"
            onClick={form.save}
            disabled={form.saving}
            className="h-8 gap-1.5 rounded-md"
          >
            {form.saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Spara bedömning
          </Button>
          {form.isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => form.startEditing()}
              className="h-8 rounded-md"
            >
              Avbryt
            </Button>
          )}
        </div>
        {form.saveError && (
          <p className="text-xs text-destructive text-center">
            {form.saveError}
          </p>
        )}
      </div>
    </div>
  )
}

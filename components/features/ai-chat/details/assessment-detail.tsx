'use client'

/**
 * Story 14.15b, Task 4.2: Assessment detail in sidebar.
 * Full assessment form with change event context header.
 * Handles both entry points:
 *   (a) auto-opened from save_assessment(execute: false) write preview
 *   (b) opened from change-assessment-view.tsx for contextType='change'
 */

import {
  Check,
  Loader2,
  Pencil,
  ShieldCheck,
  Calendar,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { cn } from '@/lib/utils'
import { useAssessmentForm } from '@/lib/hooks/use-assessment-form'
import {
  STATUS_OPTIONS,
  IMPACT_OPTIONS,
  STATUS_LABELS,
  IMPACT_LABELS,
  STATUS_VARIANT,
  AiSuggestionHint,
} from '@/components/features/changes/assessment-resolution'
import {
  useChatDetail,
  type AssessmentDetailData,
} from '@/lib/ai/chat-detail-context'
import type { AssessmentStatus, ImpactLevel, ChangeType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Swedish labels
// ---------------------------------------------------------------------------

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  NEW_LAW: 'Ny lag',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
  UPCOMING_AMENDMENT: 'Kommande ändring',
}

// Inlined from lib/utils/effective-date.ts to avoid Prisma client import in browser
function getEffectiveDateBadge(date: Date | null): {
  text: string
  variant: 'amber' | 'red' | 'green' | 'gray'
} {
  if (!date) return { text: 'Ikraftträdandedatum okänt', variant: 'gray' }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  const dateStr = target.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  if (diffDays > 0)
    return { text: `Träder i kraft ${dateStr}`, variant: 'amber' }
  if (diffDays === 0)
    return { text: `Träder i kraft idag (${dateStr})`, variant: 'red' }
  return { text: `I kraft sedan ${dateStr}`, variant: 'green' }
}

const EFFECTIVE_DATE_COLORS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  green:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  gray: 'bg-muted text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssessmentDetailProps {
  data: AssessmentDetailData
}

export function AssessmentDetail({ data }: AssessmentDetailProps) {
  const { addSystemMessage } = useChatDetail()

  // A saved assessment always wins. Otherwise, if the agent proposed one via a
  // save_assessment preview, pre-fill from it and flag it as an AI suggestion.
  const isAiSuggested = !data.existingAssessment && !!data.recommendation
  const initial = data.existingAssessment
    ? {
        status: data.existingAssessment.status as AssessmentStatus,
        impactLevel: data.existingAssessment.impactLevel as ImpactLevel,
        userNotes: data.existingAssessment.userNotes ?? '',
      }
    : data.recommendation
      ? {
          status: data.recommendation.status,
          impactLevel: data.recommendation.impactLevel,
          userNotes: data.recommendation.notes ?? '',
        }
      : undefined

  const form = useAssessmentForm({
    changeEventId: data.changeEventId,
    lawListItemId: data.lawListItemId,
    ...(initial ? { initial } : {}),
    onComplete: () => {
      addSystemMessage('Bedömning sparad')
    },
  })

  const effectiveBadge = getEffectiveDateBadge(data.effectiveDate)
  const changeTypeLabel =
    CHANGE_TYPE_LABELS[data.changeType as ChangeType] ?? data.changeType

  return (
    <div className="space-y-4">
      {/* Guiding intro */}
      <div className="flex gap-2.5 rounded-lg bg-primary/5 border border-primary/10 p-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Granska ändringen och dokumentera din bedömning. Välj status och
          påverkansnivå utifrån hur ändringen berör er verksamhet.
        </p>
      </div>

      {/* Change event context — compact, not repeating what's in the sidebar header */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {changeTypeLabel}
          </Badge>
          {data.amendmentSfs && (
            <span className="text-xs text-muted-foreground">
              {data.amendmentSfs}
            </span>
          )}
        </div>

        {data.affectedSections.length > 0 && (
          <div>
            <span className="text-[11px] text-muted-foreground">
              Berörda avsnitt:{' '}
            </span>
            <span className="text-xs">{data.affectedSections.join(', ')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded ${EFFECTIVE_DATE_COLORS[effectiveBadge.variant]}`}
          >
            {effectiveBadge.text}
          </span>
        </div>
      </div>

      {/* AI analysis (if available) */}
      {data.existingAssessment?.aiAnalysis && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            AI-analys
          </p>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {data.existingAssessment.aiAnalysis}
            </p>
          </div>
        </div>
      )}

      {/* Divider before form */}
      <div className="h-px bg-border" />

      {/* Assessment form or completion state */}
      {form.isCompleted && form.assessment ? (
        <CompletedState
          form={form}
          {...(data.onComplete ? { onClose: data.onComplete } : {})}
        />
      ) : (
        <EditingState form={form} isAiSuggested={isAiSuggested} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompletedState({
  form,
  onClose,
}: {
  form: ReturnType<typeof useAssessmentForm>
  onClose?: () => void
}) {
  if (!form.assessment) return null

  return (
    <div className="relative overflow-hidden rounded-xl bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.025)] ring-1 ring-border/45">
      <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
      <div className="space-y-3 py-4 pl-5 pr-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.04em]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-safiro font-medium text-foreground">
            Bedömning sparad
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {new Date(form.assessment.assessedAt).toLocaleDateString('sv-SE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
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
              onClick={() => {
                // Mirrors assessment-resolution.tsx — toast bridges the
                // dismiss → dashboard gap with a persistent confirmation.
                toast.success('Bedömning sparad', {
                  description: 'Lagändringen är hanterad.',
                })
                onClose()
              }}
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

function EditingState({
  form,
  isAiSuggested = false,
}: {
  form: ReturnType<typeof useAssessmentForm>
  isAiSuggested?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.025)]',
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
          className="text-sm min-h-[80px] resize-none"
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

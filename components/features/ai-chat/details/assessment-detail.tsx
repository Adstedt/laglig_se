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
import {
  STATUS_OPTIONS,
  IMPACT_OPTIONS,
  STATUS_LABELS,
  IMPACT_LABELS,
  STATUS_VARIANT,
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
  if (diffDays > 0)
    return { text: `Träder i kraft om ${diffDays} dagar`, variant: 'amber' }
  if (diffDays === 0) return { text: 'Träder i kraft idag', variant: 'red' }
  return { text: 'Trädde i kraft', variant: 'green' }
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

  const initial = data.existingAssessment
    ? {
        status: data.existingAssessment.status as AssessmentStatus,
        impactLevel: data.existingAssessment.impactLevel as ImpactLevel,
        userNotes: data.existingAssessment.userNotes ?? '',
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
        <CompletedState form={form} />
      ) : (
        <EditingState form={form} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompletedState({
  form,
}: {
  form: ReturnType<typeof useAssessmentForm>
}) {
  if (!form.assessment) return null

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium">Bedömning sparad</span>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge variant={STATUS_VARIANT[form.assessment.status]}>
              {STATUS_LABELS[form.assessment.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Påverkan:</span>
            <span className="text-sm font-medium">
              {IMPACT_LABELS[form.assessment.impactLevel]}
            </span>
          </div>
        </div>
        {form.assessment.userNotes && (
          <p className="text-sm text-muted-foreground">
            {form.assessment.userNotes}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={form.startEditing}
          className="gap-1.5 -ml-2"
        >
          <Pencil className="h-3 w-3" />
          Ändra bedömning
        </Button>
      </div>
    </div>
  )
}

function EditingState({
  form,
}: {
  form: ReturnType<typeof useAssessmentForm>
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Din bedömning
      </p>

      <div className="space-y-3">
        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
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
          <span className="text-xs text-muted-foreground mb-1 block">
            Påverkan på verksamheten
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

      <div>
        <span className="text-xs text-muted-foreground mb-1 block">
          Anteckningar
        </span>
        <Textarea
          placeholder="Beskriv hur ändringen påverkar er, vilka åtgärder som behövs..."
          value={form.userNotes}
          onChange={(e) => form.setUserNotes(e.target.value)}
          className="text-sm min-h-[100px] resize-none"
        />
      </div>

      <Button
        size="sm"
        onClick={form.save}
        disabled={form.saving}
        className="w-full"
      >
        {form.saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
        ) : (
          <Check className="h-4 w-4 mr-1.5" />
        )}
        Spara bedömning
      </Button>
      {form.saveError && (
        <p className="text-xs text-destructive text-center">{form.saveError}</p>
      )}
    </div>
  )
}

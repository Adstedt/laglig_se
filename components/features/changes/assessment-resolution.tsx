'use client'

/**
 * Story 14.10, Task 5: Assessment Resolution UI
 * Inline component rendered in the chat message scroll area.
 * Two states: editable form → read-only completion summary.
 */

import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2, Pencil, ShieldCheck } from 'lucide-react'
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
import {
  createOrUpdateAssessment,
  getAssessment,
  type AssessmentData,
} from '@/app/actions/change-assessment'
import type { AssessmentStatus, ImpactLevel } from '@prisma/client'

// ---------------------------------------------------------------------------
// Swedish labels
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: AssessmentStatus; label: string }[] = [
  { value: 'REVIEWED', label: 'Granskad' },
  { value: 'ACTION_REQUIRED', label: 'Åtgärd krävs' },
  { value: 'NOT_APPLICABLE', label: 'Ej tillämplig' },
  { value: 'DEFERRED', label: 'Uppskjuten' },
]

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = [
  { value: 'HIGH', label: 'Hög' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'LOW', label: 'Låg' },
  { value: 'NONE', label: 'Ingen' },
]

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  REVIEWED: 'Granskad',
  ACTION_REQUIRED: 'Åtgärd krävs',
  NOT_APPLICABLE: 'Ej tillämplig',
  DEFERRED: 'Uppskjuten',
}

const IMPACT_LABELS: Record<ImpactLevel, string> = {
  HIGH: 'Hög',
  MEDIUM: 'Medel',
  LOW: 'Låg',
  NONE: 'Ingen',
}

const STATUS_VARIANT: Record<
  AssessmentStatus,
  'default' | 'destructive' | 'secondary' | 'outline'
> = {
  REVIEWED: 'default',
  ACTION_REQUIRED: 'destructive',
  NOT_APPLICABLE: 'secondary',
  DEFERRED: 'outline',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssessmentResolutionProps {
  changeEventId: string
  lawListItemId: string
  /** Called after a successful save — parent can offer navigation */
  onComplete?: (() => void) | undefined
}

export function AssessmentResolution({
  changeEventId,
  lawListItemId,
  onComplete,
}: AssessmentResolutionProps) {
  const [status, setStatus] = useState<AssessmentStatus>('REVIEWED')
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>('MEDIUM')
  const [userNotes, setUserNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Completed = we have a saved assessment and we're not editing it
  const isCompleted = assessment !== null && !isEditing

  // Load existing assessment on mount
  useEffect(() => {
    async function load() {
      const result = await getAssessment(changeEventId, lawListItemId)
      if (result.success && result.data) {
        setAssessment(result.data)
        setStatus(result.data.status)
        setImpactLevel(result.data.impactLevel)
        setUserNotes(result.data.userNotes ?? '')
      }
    }
    load()
  }, [changeEventId, lawListItemId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const result = await createOrUpdateAssessment({
        changeEventId,
        lawListItemId,
        status,
        impactLevel,
        userNotes: userNotes || undefined,
      })
      if (result.success && result.data) {
        setAssessment(result.data)
        setIsEditing(false)
        onComplete?.()
      } else {
        setSaveError(result.error ?? 'Kunde inte spara bedömningen')
      }
    } finally {
      setSaving(false)
    }
  }, [changeEventId, lawListItemId, status, impactLevel, userNotes, onComplete])

  const handleEdit = useCallback(() => {
    if (assessment) {
      setStatus(assessment.status)
      setImpactLevel(assessment.impactLevel)
      setUserNotes(assessment.userNotes ?? '')
    }
    setIsEditing(true)
  }, [assessment])

  // ----- Completion state -----
  if (isCompleted) {
    return (
      <div className="rounded-lg border bg-card mx-1 mt-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">Bedömning sparad</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(assessment.assessedAt).toLocaleDateString('sv-SE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge variant={STATUS_VARIANT[assessment.status]}>
                {STATUS_LABELS[assessment.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Påverkan:</span>
              <span className="text-sm font-medium">
                {IMPACT_LABELS[assessment.impactLevel]}
              </span>
            </div>
          </div>
          {assessment.userNotes && (
            <p className="text-sm text-muted-foreground">
              {assessment.userNotes}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="gap-1.5 -ml-2"
          >
            <Pencil className="h-3 w-3" />
            Ändra bedömning
          </Button>
        </div>
      </div>
    )
  }

  // ----- Editing / new state -----
  return (
    <div className="rounded-lg border bg-card mx-1 mt-4 px-4 py-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Bedömning
      </p>

      <div className="flex gap-3">
        {/* Status selector */}
        <div className="flex-1">
          <span className="text-xs text-muted-foreground mb-1 block">
            Status
          </span>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as AssessmentStatus)}
          >
            <SelectTrigger className="h-8 text-sm">
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

        {/* Impact level selector */}
        <div className="flex-1">
          <span className="text-xs text-muted-foreground mb-1 block">
            Påverkan
          </span>
          <Select
            value={impactLevel}
            onValueChange={(v) => setImpactLevel(v as ImpactLevel)}
          >
            <SelectTrigger className="h-8 text-sm">
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

      {/* Optional notes */}
      <Textarea
        placeholder="Anteckningar (valfritt)..."
        value={userNotes}
        onChange={(e) => setUserNotes(e.target.value)}
        className="text-sm min-h-[60px] resize-none"
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Spara bedömning
        </Button>
        {isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Avbryt
          </Button>
        )}
        {saveError && (
          <span className="text-xs text-destructive">{saveError}</span>
        )}
      </div>
    </div>
  )
}

/**
 * Story 14.15b, Task 4.1: Shared assessment form hook.
 * Extracted from assessment-resolution.tsx — used by both the
 * footer component (AssessmentResolution) and the sidebar detail (AssessmentDetail).
 */

import { useState, useEffect, useCallback } from 'react'
import {
  createOrUpdateAssessment,
  getAssessment,
  type AssessmentData,
} from '@/app/actions/change-assessment'
import type { AssessmentStatus, ImpactLevel } from '@prisma/client'

interface UseAssessmentFormOptions {
  changeEventId: string
  lawListItemId: string
  /** Pre-fill from existing data (e.g. from sidebar detail context) */
  initial?: {
    status?: AssessmentStatus
    impactLevel?: ImpactLevel
    userNotes?: string
  }
  onComplete?: () => void
}

export function useAssessmentForm({
  changeEventId,
  lawListItemId,
  initial,
  onComplete,
}: UseAssessmentFormOptions) {
  const [status, setStatus] = useState<AssessmentStatus>(
    initial?.status ?? 'REVIEWED'
  )
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>(
    initial?.impactLevel ?? 'MEDIUM'
  )
  const [userNotes, setUserNotes] = useState(initial?.userNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const isCompleted = assessment !== null && !isEditing

  // Load existing assessment on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      const result = await getAssessment(changeEventId, lawListItemId)
      if (cancelled) return
      if (result.success && result.data) {
        setAssessment(result.data)
        setStatus(result.data.status)
        setImpactLevel(result.data.impactLevel)
        setUserNotes(result.data.userNotes ?? '')
      }
      setLoaded(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [changeEventId, lawListItemId])

  const save = useCallback(async () => {
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
        return true
      } else {
        setSaveError(result.error ?? 'Kunde inte spara bedömningen')
        return false
      }
    } finally {
      setSaving(false)
    }
  }, [changeEventId, lawListItemId, status, impactLevel, userNotes, onComplete])

  const startEditing = useCallback(() => {
    if (assessment) {
      setStatus(assessment.status)
      setImpactLevel(assessment.impactLevel)
      setUserNotes(assessment.userNotes ?? '')
    }
    setIsEditing(true)
  }, [assessment])

  return {
    status,
    setStatus,
    impactLevel,
    setImpactLevel,
    userNotes,
    setUserNotes,
    saving,
    saveError,
    assessment,
    isCompleted,
    isEditing,
    loaded,
    save,
    startEditing,
  }
}

'use client'

/**
 * Story 16.4, Task 6 (AC: 19-24)
 * Dashboard progress indicator for law list generation.
 * Polls generation status every 3 seconds, shows step-by-step progress.
 */

import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import {
  Check,
  Circle,
  Loader2,
  AlertTriangle,
  ListChecks,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ProgressStep {
  label: string
  status: 'done' | 'active' | 'pending'
  detail?: string
}

interface GroupSummary {
  name: string
  count: number
}

interface GenerationStatusResponse {
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: ProgressStep[] | null
  itemCount?: number
  groups?: GroupSummary[]
  error: string | null
}

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json() as Promise<GenerationStatusResponse>)

interface LawListGenerationProgressProps {
  initialStatus: string | null
}

export function LawListGenerationProgress({
  initialStatus,
}: LawListGenerationProgressProps) {
  const { data, mutate } = useSWR<GenerationStatusResponse>(
    '/api/workspace/generation-status',
    fetcher,
    {
      refreshInterval: (latestData) => {
        const s = latestData?.status ?? initialStatus
        return s === 'pending' || s === 'in_progress' ? 3000 : 0
      },
      revalidateOnFocus: false,
    }
  )

  const status = data?.status ?? initialStatus
  const progress = data?.progress ?? null

  // Retry logic: if status is 'pending' on load, re-fire generation
  const triggerRetry = useCallback(async () => {
    try {
      await fetch('/api/workspace/generate-law-list', { method: 'POST' })
      mutate()
    } catch {
      // Retry failed — will try again on next poll
    }
  }, [mutate])

  useEffect(() => {
    if (status === 'pending') {
      triggerRetry()
    }
  }, [status, triggerRetry])

  // Don't render if completed and dismissed, or no status
  if (!status || status === 'completed' || status === 'failed') {
    if (status === 'completed' && data?.itemCount) {
      return <CompletedCard itemCount={data.itemCount} groups={data.groups} />
    }
    if (status === 'failed') {
      return <FailedCard error={data?.error ?? null} />
    }
    return null
  }

  // Show only the current active step (or last completed if none active)
  const currentStep =
    progress && progress.length > 0
      ? (progress.findLast((s) => s.status === 'active') ??
        progress.findLast((s) => s.status === 'done'))
      : null
  const doneCount = progress
    ? progress.filter((s) => s.status === 'done').length
    : 0

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Vi skapar er personliga laglista...
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Detta kan ta upp till 5 minuter. Du kan navigera fritt under tiden.
        </p>
      </CardHeader>
      <CardContent>
        {currentStep ? (
          <div className="flex items-center gap-2 text-sm">
            <StepIcon status={currentStep.status} />
            <span className="text-foreground font-medium">
              {currentStep.label}
            </span>
            {currentStep.detail && (
              <span className="text-muted-foreground text-xs">
                {currentStep.detail}
              </span>
            )}
            {doneCount > 0 && (
              <span className="text-muted-foreground/50 text-xs ml-auto">
                Steg {doneCount}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Förbereder...</p>
        )}
      </CardContent>
    </Card>
  )
}

function StepIcon({ status }: { status: ProgressStep['status'] }) {
  switch (status) {
    case 'done':
      return <Check className="h-4 w-4 text-muted-foreground" />
    case 'active':
      return (
        <Circle className="h-4 w-4 text-primary fill-primary animate-pulse" />
      )
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground/40" />
  }
}

function CompletedCard({
  itemCount,
  groups,
}: {
  itemCount: number
  groups?: GroupSummary[] | undefined
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const groupText =
    groups && groups.length > 0
      ? groups.map((g) => `${g.count} ${g.name}`).join(', ')
      : null

  return (
    <Card className="relative border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </button>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-green-600 dark:text-green-400" />
          Er laglista är klar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {itemCount} lagar har lagts till baserat på er företagsprofil.
          </p>
          {groupText && (
            <p className="text-xs text-muted-foreground">{groupText}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/laglistor">Visa laglistan</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function FailedCard({ error }: { error?: string | null }) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Laglistan kunde inte skapas automatiskt
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {error ?? 'Du kan skapa din lista manuellt.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/laglistor">Skapa manuellt</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

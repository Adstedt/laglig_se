'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Question } from '@/lib/onboarding/question-selector'

export interface ActivityFlags {
  [key: string]: boolean
}

interface ActivityQuestionsStepProps {
  questions: Question[]
  onNext: (_flags: ActivityFlags) => void
  onBack: () => void
}

export function ActivityQuestionsStep({
  questions,
  onNext,
  onBack,
}: ActivityQuestionsStepProps) {
  const [flags, setFlags] = useState<ActivityFlags>(() => {
    const initial: ActivityFlags = {}
    for (const q of questions) {
      initial[q.flagKey] = q.defaultValue
    }
    return initial
  })

  const handleToggle = (flagKey: string, checked: boolean) => {
    setFlags((prev) => ({ ...prev, [flagKey]: checked }))
  }

  const handleNext = () => {
    onNext(flags)
  }

  const handleSkip = () => {
    // Skip = all false
    const empty: ActivityFlags = {}
    for (const q of questions) {
      empty[q.flagKey] = false
    }
    onNext(empty)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-safiro text-2xl font-semibold tracking-tight">
          Hjälp oss förstå er verksamhet bättre
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ju mer vi vet, desto bättre kan vi identifiera relevanta regler.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div
            key={q.id}
            className="flex items-start justify-between gap-4 rounded-lg border p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`question-${q.id}`}
                  className="text-sm font-medium leading-tight"
                >
                  {q.label}
                </Label>
                {q.inferredFromWebsite && flags[q.flagKey] && (
                  <Badge variant="secondary" className="text-xs">
                    Baserat på er webbplats
                  </Badge>
                )}
              </div>
              <p
                id={`question-${q.id}-desc`}
                className="text-xs text-muted-foreground"
              >
                {q.description}
              </p>
            </div>
            <Switch
              id={`question-${q.id}`}
              checked={flags[q.flagKey] ?? false}
              onCheckedChange={(checked) => handleToggle(q.flagKey, checked)}
              aria-describedby={`question-${q.id}-desc`}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          Tillbaka
        </Button>
        <Button type="button" variant="ghost" onClick={handleSkip}>
          Hoppa över
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          Nästa
        </Button>
      </div>
    </div>
  )
}

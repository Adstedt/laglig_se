'use client'

import { CalendarClock, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface FutureAmendment {
  date: string
  formattedDate: string
}

interface FutureAmendmentsBannerProps {
  amendments: FutureAmendment[]
}

export function FutureAmendmentsBanner({
  amendments,
}: FutureAmendmentsBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (amendments.length === 0 || dismissed) {
    return null
  }

  // Get the earliest future date
  const sortedAmendments = [...amendments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const firstAmendment = sortedAmendments[0]
  if (!firstAmendment) return null
  const nextDate = firstAmendment.formattedDate
  const uniqueDates = [...new Set(amendments.map((a) => a.formattedDate))]

  return (
    <div className="relative mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex gap-3">
        <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-amber-800 dark:text-amber-200 font-semibold text-sm">
            Innehåller ändringar som ännu inte trätt i kraft
          </h4>
          <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
            {uniqueDates.length === 1 ? (
              <>
                Delar av denna lag träder i kraft <strong>{nextDate}</strong>.
                Dessa avsnitt är markerade nedan.
              </>
            ) : (
              <>
                Denna lag innehåller ändringar som träder i kraft vid olika
                tidpunkter: <strong>{uniqueDates.join(', ')}</strong>.
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Stäng</span>
        </Button>
      </div>
    </div>
  )
}

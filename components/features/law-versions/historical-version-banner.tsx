'use client'

import Link from 'next/link'
import { Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HistoricalVersionBannerProps {
  formattedDate: string // Format: "1 januari 2020"
  currentVersionUrl: string // URL to current version
}

export function HistoricalVersionBanner({
  formattedDate,
  currentVersionUrl,
}: HistoricalVersionBannerProps) {
  return (
    <div className="mb-6 rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-blue-800 dark:text-blue-200 font-semibold text-sm">
              Du visar en historisk version
            </h4>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
              Denna version gällde per <strong>{formattedDate}</strong>.
              Observera att lagen kan ha ändrats sedan dess.
            </p>
          </div>
        </div>
        <div className="flex gap-2 ml-8 sm:ml-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={currentVersionUrl}>
              Visa gällande version
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

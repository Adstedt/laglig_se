import { CalendarClock } from 'lucide-react'

interface NotYetInForceBannerProps {
  effectiveDate: string // Format: "1 januari 2026"
  title?: string // Document title to determine if it's a förordning
}

export function NotYetInForceBanner({
  effectiveDate,
  title,
}: NotYetInForceBannerProps) {
  // Check if this is a förordning based on title
  const isForordning = title?.toLowerCase().startsWith('förordning')
  const documentTypeCapitalized = isForordning ? 'Förordningen' : 'Lagen'
  const thisDocument = isForordning ? 'Denna förordning' : 'Denna lag'

  return (
    <div className="mb-6 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/30">
      <div className="flex gap-3">
        <CalendarClock className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-orange-800 dark:text-orange-200 font-semibold text-sm">
            {thisDocument} har ännu inte trätt i kraft
          </h4>
          <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">
            {documentTypeCapitalized} träder i kraft den{' '}
            <strong>{effectiveDate}</strong>. Innehållet visar den beslutade
            lydelsen som kommer att gälla från ikraftträdandet.
          </p>
        </div>
      </div>
    </div>
  )
}

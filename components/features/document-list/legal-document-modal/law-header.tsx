'use client'

/**
 * Story 6.3: Law Header
 * Simple title display - details moved to right panel
 */

interface LawHeaderProps {
  title: string
  aiCommentary: string | null
}

export function LawHeader({ title, aiCommentary }: LawHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Title */}
      <h2 className="text-2xl font-semibold leading-tight">{title}</h2>

      {/* AI Commentary if present */}
      {aiCommentary && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">AI-sammanfattning: </span>
            {aiCommentary}
          </p>
        </div>
      )}
    </div>
  )
}

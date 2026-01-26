'use client'

/**
 * Story 6.3: Evidence Summary Box
 * File count and thumbnail grid of recent evidence
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Image, FileSpreadsheet, File } from 'lucide-react'
import type { EvidenceSummary } from '@/app/actions/legal-document-modal'
import { cn } from '@/lib/utils'

interface EvidenceSummaryBoxProps {
  evidence: EvidenceSummary[] | null
  onViewAll: () => void
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return FileText // Default icon for folders
  if (mimeType.startsWith('image/')) {
    return Image
  }
  if (mimeType === 'application/pdf') {
    return FileText
  }
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  ) {
    return FileSpreadsheet
  }
  return File
}

export function EvidenceSummaryBox({
  evidence,
  onViewAll,
}: EvidenceSummaryBoxProps) {
  // Handle model not existing (graceful fallback)
  if (evidence === null) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Bevis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceEmptyState />
        </CardContent>
      </Card>
    )
  }

  const count = evidence.length

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Bevis
          </CardTitle>
          {count > 0 && (
            <span className="text-xs text-muted-foreground">
              {count} {count === 1 ? 'fil' : 'filer'} bifogade
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {count > 0 ? (
          <div className="space-y-3">
            {/* Thumbnail grid (2x2 max) */}
            <div className="grid grid-cols-2 gap-2">
              {evidence.slice(0, 4).map((file) => {
                const Icon = getFileIcon(file.mimeType)
                return (
                  <button
                    key={file.id}
                    onClick={onViewAll}
                    className={cn(
                      'flex flex-col items-center justify-center',
                      'h-16 rounded-md border bg-muted/30',
                      'hover:bg-muted/50 transition-colors',
                      'p-2'
                    )}
                    title={file.filename}
                  >
                    <Icon className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
                      {file.filename}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* View all link if more than 4 */}
            {count > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={onViewAll}
              >
                Visa alla {count} filer
              </Button>
            )}
          </div>
        ) : (
          <EvidenceEmptyState />
        )}
      </CardContent>
    </Card>
  )
}

function EvidenceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <div className="rounded-full bg-muted p-2 mb-2">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Inga bevis bifogade</p>
    </div>
  )
}

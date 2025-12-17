'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  History,
  Plus,
  Minus,
  Edit,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface HistoryEntry {
  effectiveDate: string | null // YYYY-MM-DD
  amendmentSfs: string | null
  changeType: 'new' | 'amended' | 'repealed' | 'original'
  isCurrent: boolean
  textPreview: string | null
}

interface SectionHistoryData {
  baseLawSfs: string
  chapter: string | null
  section: string
  sectionRef: string
  totalVersions: number
  history: HistoryEntry[]
}

interface SectionHistoryPanelProps {
  lawSfs: string
  lawSlug: string
  chapter: string | null
  section: string
  className?: string
  defaultOpen?: boolean
}

export function SectionHistoryPanel({
  lawSfs,
  lawSlug,
  chapter,
  section,
  className,
  defaultOpen = false,
}: SectionHistoryPanelProps) {
  const [data, setData] = useState<SectionHistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Fetch history when panel is opened
  useEffect(() => {
    if (!isOpen || data) return

    async function fetchHistory() {
      setLoading(true)
      setError(null)
      try {
        const chapterParam = chapter || '_'
        const res = await fetch(
          `/api/laws/${encodeURIComponent(lawSfs)}/sections/${encodeURIComponent(chapterParam)}/${encodeURIComponent(section)}/history`
        )
        if (!res.ok) {
          throw new Error('Kunde inte hämta historik')
        }
        const historyData = await res.json()
        setData(historyData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [isOpen, lawSfs, chapter, section, data])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ursprunglig'
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const changeTypeConfig = {
    new: {
      icon: Plus,
      label: 'Införd',
      badgeClass:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    amended: {
      icon: Edit,
      label: 'Ändrad',
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    repealed: {
      icon: Minus,
      label: 'Upphävd',
      badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    original: {
      icon: FileText,
      label: 'Ursprunglig',
      badgeClass:
        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    },
  }

  const sectionRef = chapter ? `${chapter} kap. ${section} §` : `${section} §`

  return (
    <div className={cn('border rounded-lg', className)}>
      <Accordion
        type="single"
        collapsible
        value={isOpen ? 'history' : ''}
        onValueChange={(v) => setIsOpen(v === 'history')}
      >
        <AccordionItem value="history" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Historik för {sectionRef}
              </span>
              {data && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {data.totalVersions} versioner
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {loading && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Laddar historik...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 py-4">
                {error}
              </div>
            )}

            {data && !loading && (
              <div className="space-y-3">
                {data.history.map((entry, index) => {
                  const config = changeTypeConfig[entry.changeType]
                  const Icon = config.icon

                  return (
                    <div
                      key={`${entry.amendmentSfs || 'original'}-${index}`}
                      className={cn(
                        'relative pl-6 pb-3',
                        index < data.history.length - 1 &&
                          'border-l-2 border-muted ml-2'
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute -left-[5px] top-0 h-3 w-3 rounded-full border-2',
                          entry.isCurrent
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground/30'
                        )}
                      />

                      <div className="space-y-1">
                        {/* Header row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">
                            {formatDate(entry.effectiveDate)}
                          </span>
                          <Badge className={cn('text-xs', config.badgeClass)}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          {entry.isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Gällande
                            </Badge>
                          )}
                        </div>

                        {/* Amendment reference */}
                        {entry.amendmentSfs && (
                          <div className="text-xs text-muted-foreground">
                            SFS {entry.amendmentSfs}
                          </div>
                        )}

                        {/* Text preview */}
                        {entry.textPreview && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {entry.textPreview}
                            {entry.textPreview.length >= 200 && '...'}
                          </p>
                        )}

                        {/* Link to version */}
                        {entry.effectiveDate && !entry.isCurrent && (
                          <Link
                            href={`/lagar/${lawSlug}/version/${entry.effectiveDate}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          >
                            Visa denna version
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {data && data.history.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Ingen ändringshistorik tillgänglig för denna paragraf.
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

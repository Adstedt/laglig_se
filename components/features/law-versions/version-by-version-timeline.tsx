'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Minus,
  Edit,
  Loader2,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  FileDown,
} from 'lucide-react'

// Types
interface Amendment {
  sfsNumber: string
  effectiveDate: string | null // YYYY-MM-DD or null
  title?: string | undefined
  sectionsChanged: number
  sectionsAdded?: number | undefined
  sectionsRepealed?: number | undefined
  pdfUrl?: string | null | undefined // Full URL to PDF in Supabase storage
  slug?: string | null | undefined // Story 2.29: Link to amendment detail page
}

interface LineDiff {
  type: 'add' | 'remove' | 'context'
  content: string
}

interface SectionDiff {
  chapter: string | null
  section: string
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  linesAdded: number
  linesRemoved: number
  textA?: string
  textB?: string
  lineDiff?: LineDiff[]
  textUnavailable?: boolean
}

interface AmendmentDiff {
  baseLawSfs: string
  amendmentSfs: string
  effectiveDate: string
  previousDate: string
  summary: {
    sectionsAdded: number
    sectionsRemoved: number
    sectionsModified: number
  }
  sections: SectionDiff[]
}

interface VersionByVersionTimelineProps {
  lawSlug: string
  baseLawSfs: string
  amendments: Amendment[]
  maxVisible?: number
  isWorkspace?: boolean
}

export function VersionByVersionTimeline({
  lawSlug,
  baseLawSfs,
  amendments,
  maxVisible = 15,
  isWorkspace = false,
}: VersionByVersionTimelineProps) {
  // Prefix for internal links - workspace or public
  const basePath = isWorkspace ? '/browse/lagar' : '/lagar'
  const [expanded, setExpanded] = useState(false)
  const [expandedAmendments, setExpandedAmendments] = useState<Set<string>>(
    new Set()
  )
  const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set())
  const [diffs, setDiffs] = useState<Map<string, AmendmentDiff>>(new Map())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )

  // Track how far we've prefetched for rolling prefetch
  const prefetchedUpToRef = useRef(0)
  const prefetchTriggerRef = useRef<HTMLDivElement>(null)
  const PREFETCH_BATCH_SIZE = 5

  // Prefetch first batch of diffs after initial render
  useEffect(() => {
    // Wait for page to settle before prefetching
    const timer = setTimeout(() => {
      const toPrefetch = amendments.slice(0, PREFETCH_BATCH_SIZE)
      toPrefetch.forEach((amendment, index) => {
        // Stagger prefetches to avoid overwhelming the server
        setTimeout(() => {
          // Only prefetch if not already in cache
          if (!diffs.has(amendment.sfsNumber)) {
            fetchDiff(amendment.sfsNumber, true)
          }
        }, index * 200) // 200ms between each prefetch
      })
      prefetchedUpToRef.current = PREFETCH_BATCH_SIZE
    }, 500) // 500ms after page render

    return () => clearTimeout(timer)
    // Only run on mount - don't re-run when diffs changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendments, baseLawSfs])

  // Rolling prefetch: fetch next batch when user scrolls near the trigger
  useEffect(() => {
    const trigger = prefetchTriggerRef.current
    if (!trigger) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const currentPrefetched = prefetchedUpToRef.current
          const nextBatch = amendments.slice(
            currentPrefetched,
            currentPrefetched + PREFETCH_BATCH_SIZE
          )

          if (nextBatch.length > 0) {
            nextBatch.forEach((amendment, index) => {
              setTimeout(() => {
                if (!diffs.has(amendment.sfsNumber)) {
                  fetchDiff(amendment.sfsNumber, true)
                }
              }, index * 200)
            })
            prefetchedUpToRef.current = currentPrefetched + nextBatch.length
          }
        }
      },
      { rootMargin: '300px' } // Trigger 300px before element is visible
    )

    observer.observe(trigger)

    return () => observer.disconnect()
    // Re-observe when amendments change or after we prefetch more
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendments, baseLawSfs])

  const visibleAmendments = expanded
    ? amendments
    : amendments.slice(0, maxVisible)
  const hasMore = amendments.length > maxVisible

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Datum saknas'
    const date = new Date(dateStr)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Build Riksdagen URL for an amendment
  const getRiksdagenUrl = (sfsNumber: string) => {
    const sfsClean = sfsNumber.replace(/^SFS\s*/i, '')
    return `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${sfsClean.replace(':', '-')}/`
  }

  // Format SFS number (remove "SFS " prefix if present)
  const formatSfs = (sfs: string) => {
    return sfs.replace(/^SFS\s*/i, '')
  }

  // Fetch diff for an amendment
  // isPrefetch: if true, don't show loading state (background fetch)
  const fetchDiff = useCallback(
    async (amendmentSfs: string, isPrefetch = false) => {
      const sfsForApi = baseLawSfs.replace(/^SFS\s*/i, '')
      const amendmentForApi = amendmentSfs.replace(/^SFS\s*/i, '')

      // Only show loading state for user-initiated fetches
      if (!isPrefetch) {
        setLoadingDiffs((prev) => new Set(prev).add(amendmentSfs))
        setErrors((prev) => {
          const next = new Map(prev)
          next.delete(amendmentSfs)
          return next
        })
      }

      try {
        const res = await fetch(
          `/api/laws/${encodeURIComponent(sfsForApi)}/diff/${encodeURIComponent(amendmentForApi)}`,
          { priority: isPrefetch ? 'low' : 'high' } as RequestInit
        )

        if (!res.ok) {
          throw new Error('Failed to fetch diff')
        }

        const data: AmendmentDiff = await res.json()
        setDiffs((prev) => new Map(prev).set(amendmentSfs, data))
      } catch (_err) {
        // Only show errors for user-initiated fetches
        if (!isPrefetch) {
          setErrors((prev) =>
            new Map(prev).set(amendmentSfs, 'Kunde inte ladda ändringar')
          )
        }
      } finally {
        if (!isPrefetch) {
          setLoadingDiffs((prev) => {
            const next = new Set(prev)
            next.delete(amendmentSfs)
            return next
          })
        }
      }
    },
    [baseLawSfs]
  )

  // Toggle amendment expansion
  const toggleAmendment = useCallback(
    (sfsNumber: string) => {
      setExpandedAmendments((prev) => {
        const next = new Set(prev)
        if (next.has(sfsNumber)) {
          next.delete(sfsNumber)
        } else {
          next.add(sfsNumber)
          // Fetch diff if not already loaded
          if (!diffs.has(sfsNumber) && !loadingDiffs.has(sfsNumber)) {
            fetchDiff(sfsNumber)
          }
        }
        return next
      })
    },
    [diffs, loadingDiffs, fetchDiff]
  )

  // Toggle section expansion
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const formatSectionRef = (chapter: string | null, section: string) => {
    if (chapter) {
      return `${chapter} kap. ${section} §`
    }
    return `${section} §`
  }

  if (amendments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Ingen ändringshistorik tillgänglig
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-0">
        {/* Current version node */}
        <div className="relative flex items-start gap-4 pb-6">
          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Gällande version</span>
              <Badge>Nuvarande</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Senast ändrad: SFS {formatSfs(amendments[0]?.sfsNumber || '')}
            </p>
          </div>
        </div>

        {/* Amendment nodes */}
        {visibleAmendments.map((amendment, idx) => {
          const isExpanded = expandedAmendments.has(amendment.sfsNumber)
          const isLoading = loadingDiffs.has(amendment.sfsNumber)
          const diff = diffs.get(amendment.sfsNumber)
          const error = errors.get(amendment.sfsNumber)
          const isLatest = idx === 0

          return (
            <div key={amendment.sfsNumber} className="relative pb-4">
              {/* Timeline node and header */}
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  'relative flex items-start gap-4 cursor-pointer group',
                  isExpanded && 'pb-3'
                )}
                onClick={() => toggleAmendment(amendment.sfsNumber)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleAmendment(amendment.sfsNumber)
                  }
                }}
              >
                {/* Timeline node */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    isExpanded
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted-foreground/30 group-hover:border-primary/50'
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Header content */}
                <div className="flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {formatDate(amendment.effectiveDate)}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      SFS {formatSfs(amendment.sfsNumber)}
                    </Badge>
                    {isLatest && (
                      <Badge variant="secondary" className="text-xs">
                        Senaste
                      </Badge>
                    )}
                  </div>

                  {amendment.title && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {amendment.title}
                    </p>
                  )}

                  {/* Summary badges and PDF link */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {(amendment.sectionsAdded ?? 0) > 0 && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                        <Plus className="h-3 w-3 mr-1" />
                        {amendment.sectionsAdded} nya
                      </Badge>
                    )}
                    {(amendment.sectionsRepealed ?? 0) > 0 && (
                      <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200">
                        <Minus className="h-3 w-3 mr-1" />
                        {amendment.sectionsRepealed} upphävda
                      </Badge>
                    )}
                    {amendment.sectionsChanged > 0 && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        <Edit className="h-3 w-3 mr-1" />
                        {amendment.sectionsChanged} ändrade
                      </Badge>
                    )}

                    {/* Story 2.29: Link to amendment detail page when available */}
                    {amendment.slug && (
                      <Link
                        href={`${basePath}/andringar/${amendment.slug}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge
                          variant="outline"
                          className="text-xs hover:bg-primary/10 cursor-pointer gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          Detaljer
                        </Badge>
                      </Link>
                    )}

                    {/* PDF/Source link */}
                    <a
                      href={
                        amendment.pdfUrl || getRiksdagenUrl(amendment.sfsNumber)
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto"
                    >
                      <Badge
                        variant="outline"
                        className="text-xs hover:bg-primary/10 cursor-pointer gap-1"
                      >
                        {amendment.pdfUrl ? (
                          <>
                            <FileDown className="h-3 w-3" />
                            PDF
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3" />
                            Riksdagen
                          </>
                        )}
                      </Badge>
                    </a>
                  </div>
                </div>
              </div>

              {/* Expanded diff content */}
              {isExpanded && (
                <div className="ml-12 mt-2 space-y-2">
                  {/* Loading state */}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Laddar ändringar...
                    </div>
                  )}

                  {/* Error state */}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 py-4">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  {/* Diff content */}
                  {diff && (
                    <div className="space-y-2">
                      {/* Date range info */}
                      <p className="text-xs text-muted-foreground mb-3">
                        Ändringar från {formatDate(diff.previousDate)} till{' '}
                        {formatDate(diff.effectiveDate)}
                      </p>

                      {/* Section diffs */}
                      {diff.sections.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Inga detaljerade ändringar tillgängliga.
                        </p>
                      ) : (
                        diff.sections.map((section) => {
                          const sectionKey = `${amendment.sfsNumber}-${section.chapter || '_'}-${section.section}`
                          const isSectionExpanded =
                            expandedSections.has(sectionKey)

                          return (
                            <SectionDiffCard
                              key={sectionKey}
                              section={section}
                              isExpanded={isSectionExpanded}
                              onToggle={() => toggleSection(sectionKey)}
                              formatSectionRef={formatSectionRef}
                            />
                          )
                        })
                      )}

                      {/* Link to full version */}
                      <div className="pt-2">
                        <Link
                          href={`${basePath}/${lawSlug}/version/${diff.effectiveDate}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Visa hela lagen vid detta datum
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Invisible trigger for rolling prefetch - placed at end of visible items */}
        <div
          ref={prefetchTriggerRef}
          className="h-px w-full"
          aria-hidden="true"
        />

        {/* Show more/less button */}
        {hasMore && (
          <div className="relative flex items-start gap-4">
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? 'Visa färre'
                : `Visa ${amendments.length - maxVisible} fler ändringar`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Separate component for section diff card
function SectionDiffCard({
  section,
  isExpanded,
  onToggle,
  formatSectionRef,
}: {
  section: SectionDiff
  isExpanded: boolean
  onToggle: () => void
  formatSectionRef: (_chapter: string | null, _section: string) => string
}) {
  const changeTypeConfig = {
    added: {
      icon: Plus,
      label: 'Tillagd',
      badgeClass:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      borderClass: 'border-l-green-500',
    },
    removed: {
      icon: Minus,
      label: 'Upphävd',
      badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      borderClass: 'border-l-red-500',
    },
    modified: {
      icon: Edit,
      label: 'Ändrad',
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      borderClass: 'border-l-amber-500',
    },
    unchanged: {
      icon: null,
      label: 'Oförändrad',
      badgeClass: 'bg-gray-100 text-gray-600',
      borderClass: 'border-l-gray-300',
    },
  }

  const config = changeTypeConfig[section.changeType]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        `border-l-4 ${config.borderClass}`
      )}
    >
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium text-sm">
            {formatSectionRef(section.chapter, section.section)}
          </span>
          <Badge className={cn('text-xs', config.badgeClass)}>
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {config.label}
          </Badge>
        </div>
        {section.changeType === 'modified' && (
          <span className="text-xs text-muted-foreground">
            {section.textUnavailable ? (
              <span className="text-amber-600 dark:text-amber-400">
                text saknas
              </span>
            ) : (
              <>
                +{section.linesAdded} / -{section.linesRemoved}
              </>
            )}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          {section.textUnavailable ? (
            <div className="p-3">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-800">
                <p className="text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Denna paragraf har ändrats, men detaljerad ändringstext
                    saknas.
                  </span>
                </p>
              </div>
            </div>
          ) : section.lineDiff && section.lineDiff.length > 0 ? (
            <div className="font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {section.lineDiff.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-3 py-0.5 whitespace-pre-wrap',
                    line.type === 'add' &&
                      'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200',
                    line.type === 'remove' &&
                      'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
                    line.type === 'context' && 'text-muted-foreground'
                  )}
                >
                  <span className="select-none mr-2 inline-block w-3 text-muted-foreground/50">
                    {line.type === 'add' && '+'}
                    {line.type === 'remove' && '-'}
                    {line.type === 'context' && ' '}
                  </span>
                  {line.content}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm">
              {section.changeType === 'added' && section.textB && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2 font-medium">
                    Ny paragraf:
                  </p>
                  <p className="whitespace-pre-wrap text-xs">{section.textB}</p>
                </div>
              )}
              {section.changeType === 'removed' && section.textA && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-700 dark:text-red-300 mb-2 font-medium">
                    Upphävd paragraf:
                  </p>
                  <p className="whitespace-pre-wrap text-xs line-through text-muted-foreground">
                    {section.textA}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

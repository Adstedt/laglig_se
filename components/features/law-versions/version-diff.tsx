'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Edit,
  Eye,
  EyeOff,
  AlertCircle,
  FileText,
} from 'lucide-react'

interface LineDiff {
  type: 'add' | 'remove' | 'context'
  content: string
  lineNumber?: number
}

interface AmendmentInfo {
  sfsNumber: string
  effectiveDate: Date | string
  changeType: string
  hasText: boolean
}

interface SectionDiff {
  chapter: string | null
  section: string
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
  linesAdded: number
  linesRemoved: number
  textA?: string // Old version
  textB?: string // New version
  lineDiff?: LineDiff[]
  /** Amendments that affected this section between dates */
  amendmentsBetween?: AmendmentInfo[]
  /** True if we know the section changed but don't have the text to show */
  textUnavailable?: boolean
}

interface VersionDiffProps {
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
  sections: SectionDiff[]
  showUnchanged?: boolean
  className?: string
}

export function VersionDiff({
  fromDate,
  toDate,
  sections,
  showUnchanged = false,
  className,
}: VersionDiffProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  )
  const [showUnchangedSections, setShowUnchangedSections] =
    useState(showUnchanged)

  // Filter sections based on showUnchanged
  const visibleSections = showUnchangedSections
    ? sections
    : sections.filter((s) => s.changeType !== 'unchanged')

  // Calculate summary
  const summary = {
    added: sections.filter((s) => s.changeType === 'added').length,
    removed: sections.filter((s) => s.changeType === 'removed').length,
    modified: sections.filter((s) => s.changeType === 'modified').length,
    unchanged: sections.filter((s) => s.changeType === 'unchanged').length,
  }

  const formatSectionRef = (chapter: string | null, section: string) => {
    if (chapter) {
      return `${chapter} kap. ${section} §`
    }
    return `${section} §`
  }

  const getSectionKey = (section: SectionDiff) =>
    `${section.chapter || '_'}-${section.section}`

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSections(newExpanded)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

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
      badgeClass:
        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
      borderClass: 'border-l-gray-300',
    },
  }

  // Generate a brief preview of the change
  const getChangePreview = (section: SectionDiff): string | null => {
    if (section.changeType === 'unchanged') return null

    // For added sections, show first part of new text
    if (section.changeType === 'added' && section.textB) {
      const preview = section.textB.substring(0, 80).trim()
      return preview + (section.textB.length > 80 ? '...' : '')
    }

    // For removed sections, show first part of old text
    if (section.changeType === 'removed' && section.textA) {
      const preview = section.textA.substring(0, 80).trim()
      return preview + (section.textA.length > 80 ? '...' : '')
    }

    // For modified sections, try to show what was added
    if (section.changeType === 'modified' && section.lineDiff) {
      const addedLines = section.lineDiff
        .filter((l) => l.type === 'add')
        .map((l) => l.content.trim())
        .join(' ')
      if (addedLines) {
        const preview = addedLines.substring(0, 80).trim()
        return preview + (addedLines.length > 80 ? '...' : '')
      }
    }

    return null
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">
              Ändringar {formatDate(fromDate)} till {formatDate(toDate)}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnchangedSections(!showUnchangedSections)}
            >
              {showUnchangedSections ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Dölj oförändrade
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Visa alla ({summary.unchanged} oförändrade)
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {summary.added > 0 && (
              <Badge className={changeTypeConfig.added.badgeClass}>
                <Plus className="h-3 w-3 mr-1" />
                {summary.added} tillagda
              </Badge>
            )}
            {summary.removed > 0 && (
              <Badge className={changeTypeConfig.removed.badgeClass}>
                <Minus className="h-3 w-3 mr-1" />
                {summary.removed} upphävda
              </Badge>
            )}
            {summary.modified > 0 && (
              <Badge className={changeTypeConfig.modified.badgeClass}>
                <Edit className="h-3 w-3 mr-1" />
                {summary.modified} ändrade
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section diffs */}
      <div className="space-y-2">
        {visibleSections.map((section) => {
          const key = getSectionKey(section)
          const isExpanded = expandedSections.has(key)
          const config = changeTypeConfig[section.changeType]
          const Icon = config.icon

          return (
            <div
              key={key}
              className={cn(
                'border rounded-lg overflow-hidden',
                `border-l-4 ${config.borderClass}`
              )}
            >
              {/* Section header */}
              <button
                className="w-full flex flex-col gap-1 p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleSection(key)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">
                      {formatSectionRef(section.chapter, section.section)}
                    </span>
                    <Badge className={cn('text-xs', config.badgeClass)}>
                      {Icon && <Icon className="h-3 w-3 mr-1" />}
                      {config.label}
                    </Badge>
                  </div>
                  {section.changeType === 'modified' && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {section.textUnavailable ? (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          text saknas
                        </span>
                      ) : (
                        <>
                          +{section.linesAdded} / -{section.linesRemoved} rader
                        </>
                      )}
                    </span>
                  )}
                </div>
                {/* Change preview when collapsed */}
                {!isExpanded &&
                  (() => {
                    const preview = getChangePreview(section)
                    return preview ? (
                      <p className="text-xs text-muted-foreground ml-7 line-clamp-1 italic">
                        {section.changeType === 'added' && '+ '}
                        {section.changeType === 'removed' && '- '}
                        &ldquo;{preview}&rdquo;
                      </p>
                    ) : null
                  })()}
              </button>

              {/* Expanded diff content */}
              {isExpanded && (
                <div className="border-t bg-muted/20">
                  {/* Show amendments that affected this section */}
                  {section.amendmentsBetween &&
                    section.amendmentsBetween.length > 0 && (
                      <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                          <FileText className="h-3 w-3 inline mr-1" />
                          Ändringsförfattningar:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {section.amendmentsBetween.map((a, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs bg-white dark:bg-gray-800"
                            >
                              {a.sfsNumber.replace(/^SFS\s*/i, '')}{' '}
                              <span className="text-muted-foreground">
                                (
                                {a.changeType === 'AMENDED'
                                  ? 'ändrad'
                                  : a.changeType === 'NEW'
                                    ? 'ny'
                                    : a.changeType === 'REPEALED'
                                      ? 'upphävd'
                                      : a.changeType === 'RENUMBERED'
                                        ? 'omnumrerad'
                                        : a.changeType}
                                )
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Text unavailable message */}
                  {section.textUnavailable && (
                    <div className="p-4 text-sm">
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-800">
                        <p className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            Denna paragraf har ändrats, men vi har inte tillgång
                            till den detaljerade ändringstexten. Se
                            ändringsförfattningen för mer information.
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Line diff */}
                  {!section.textUnavailable &&
                  section.lineDiff &&
                  section.lineDiff.length > 0 ? (
                    <div className="font-mono text-sm overflow-x-auto">
                      {section.lineDiff.map((line, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'px-4 py-0.5 whitespace-pre-wrap',
                            line.type === 'add' &&
                              'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200',
                            line.type === 'remove' &&
                              'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
                            line.type === 'context' && 'text-muted-foreground'
                          )}
                        >
                          <span className="select-none mr-2 inline-block w-4 text-muted-foreground/50">
                            {line.type === 'add' && '+'}
                            {line.type === 'remove' && '-'}
                            {line.type === 'context' && ' '}
                          </span>
                          {line.content}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !section.textUnavailable && (
                      // Fallback: show full text for added/removed sections
                      <div className="p-4 text-sm">
                        {section.changeType === 'added' && section.textB && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-700 dark:text-green-300 mb-2 font-medium">
                              Ny paragraf:
                            </p>
                            <p className="whitespace-pre-wrap">
                              {section.textB}
                            </p>
                          </div>
                        )}
                        {section.changeType === 'removed' && section.textA && (
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-700 dark:text-red-300 mb-2 font-medium">
                              Upphävd paragraf:
                            </p>
                            <p className="whitespace-pre-wrap line-through text-muted-foreground">
                              {section.textA}
                            </p>
                          </div>
                        )}
                        {section.changeType === 'unchanged' &&
                          section.textB && (
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {section.textB.substring(0, 200)}
                              {section.textB.length > 200 && '...'}
                            </p>
                          )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {visibleSections.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Inga ändringar att visa för denna period.
        </div>
      )}
    </div>
  )
}

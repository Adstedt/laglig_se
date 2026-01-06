'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  ExternalLink,
  FileText,
  Plus,
  Minus,
  Edit,
  FileDown,
  Clock,
  BookOpen,
} from 'lucide-react'
import { getPublicPdfUrl } from '@/lib/supabase/storage'
import {
  parseAmendmentStructure,
  formatAmendmentText,
  extractSfsReferences,
  type ListItem,
  type DefinitionItem,
} from '@/lib/sfs/parse-amendment-structure'
import type { SectionChangeType } from '@prisma/client'

interface SectionChange {
  id: string
  chapter: string | null
  section: string
  change_type: SectionChangeType
  old_number: string | null
  description: string | null
  new_text: string | null
}

interface AmendmentDetails {
  id: string
  sfs_number: string
  base_law_sfs: string
  base_law_name: string | null
  title: string | null
  effective_date: Date | string | null
  publication_date: Date | string | null
  storage_path: string
  markdown_content: string | null
  full_text: string | null
  confidence: number | null
  section_changes: SectionChange[]
}

interface BaseLaw {
  id: string
  slug: string
  title: string
  document_number: string
}

interface AmendmentData {
  id: string
  document_number: string
  title: string
  slug: string
  full_text: string | null
  html_content?: string | null
  effective_date: Date | string | null
  publication_date: Date | string | null
  source_url: string | null
  status: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any
  subjects: Array<{ subject_code: string; subject_name: string }>
  amendmentDetails: AmendmentDetails | null
  baseLaw: BaseLaw | null
}

interface AmendmentPageContentProps {
  amendment: AmendmentData
  isWorkspace?: boolean
}

function formatDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString(
    'sv-SE',
    options ?? { year: 'numeric', month: 'long', day: 'numeric' }
  )
}

const changeTypeConfig: Record<
  SectionChangeType,
  {
    icon: typeof Plus
    label: string
    labelShort: string
    badgeClass: string
  }
> = {
  NEW: {
    icon: Plus,
    label: 'Ny paragraf',
    labelShort: 'NY',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  AMENDED: {
    icon: Edit,
    label: 'Ändrad',
    labelShort: 'ÄNDRAD',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  REPEALED: {
    icon: Minus,
    label: 'Upphävd',
    labelShort: 'UPPHÄVD',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  RENUMBERED: {
    icon: Edit,
    label: 'Omnumrerad',
    labelShort: 'OMNUM.',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
}

/**
 * Render text with SFS references as clickable links
 */
function LinkedText({
  text,
  basePath,
}: {
  text: string
  basePath: string
}) {
  const parts = extractSfsReferences(text)

  return (
    <>
      {parts.map((part, idx) => {
        if (part.type === 'sfs' && part.sfsNumber) {
          const slug = `sfs-${part.sfsNumber.replace(':', '-')}`
          return (
            <Link
              key={idx}
              href={`${basePath}/${slug}`}
              className="text-primary hover:underline"
            >
              {part.content}
            </Link>
          )
        }
        return <span key={idx}>{part.content}</span>
      })}
    </>
  )
}

/**
 * Render a list item with optional sub-items (Notisum style)
 */
function ListItemDisplay({
  item,
  basePath,
  level = 0,
}: {
  item: ListItem
  basePath: string
  level?: number
}) {
  const indentClass = level === 0 ? '' : level === 1 ? 'ml-6' : 'ml-10'

  return (
    <div className={`flex gap-3 ${indentClass}`}>
      <span className="text-muted-foreground shrink-0 w-6 text-right tabular-nums text-sm">
        {item.marker}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-foreground leading-relaxed">
          <LinkedText text={item.text} basePath={basePath} />
        </span>
        {item.subItems && item.subItems.length > 0 && (
          <div className="mt-2 space-y-2">
            {item.subItems.map((subItem, idx) => (
              <ListItemDisplay
                key={idx}
                item={subItem}
                basePath={basePath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Render a definition list (term → section reference) like Notisum
 */
function DefinitionListDisplay({
  definitions,
  basePath,
}: {
  definitions: DefinitionItem[]
  basePath: string
}) {
  return (
    <div className="space-y-1">
      {definitions.map((def, idx) => (
        <div key={idx} className="flex gap-2 text-sm">
          <span className="text-foreground italic">{def.term}</span>
          <span className="text-muted-foreground">i</span>
          <span className="text-foreground font-medium">
            <LinkedText text={def.reference} basePath={basePath} />
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Render LLM-generated HTML content with proper styling
 * This component applies Tailwind classes to the semantic HTML structure
 */
function HtmlContentRenderer({ html }: { html: string }) {
  return (
    <div
      className="amendment-html-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function AmendmentPageContent({
  amendment,
  isWorkspace = false,
}: AmendmentPageContentProps) {
  const details = amendment.amendmentDetails
  const baseLaw = amendment.baseLaw

  const basePath = isWorkspace ? '/browse/lagar' : '/lagar'

  const pdfUrl = details?.storage_path
    ? getPublicPdfUrl(details.storage_path)
    : null

  const riksdagenUrl = details
    ? `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${details.sfs_number.replace(':', '-')}/`
    : amendment.source_url

  // Check if we have LLM-generated HTML content (preferred)
  const hasHtmlContent = !!amendment.html_content

  // Fallback: parse full_text if no html_content
  const parsedStructure = hasHtmlContent
    ? null
    : parseAmendmentStructure(details?.full_text ?? amendment.full_text)
  const formattedText = hasHtmlContent
    ? null
    : formatAmendmentText(details?.full_text ?? amendment.full_text)

  // Get section changes for badges (used in fallback mode)
  const sectionChanges = details?.section_changes ?? []
  const getSectionChangeType = (sectionNum: string): SectionChangeType | null => {
    const change = sectionChanges.find((c) => c.section === sectionNum)
    return change?.change_type ?? null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Notisum-style document container */}
      <article className="bg-card rounded-lg border shadow-sm">
        {/* Top navigation bar */}
        <div className="border-b px-4 py-2.5 flex items-center justify-between bg-muted/30">
          {/* Grundförfattning badge - prominent link to base law */}
          {baseLaw ? (
            <Link
              href={`${basePath}/${baseLaw.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-background border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Grundförfattning
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>Svensk författningssamling</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {pdfUrl && (
              <Button variant="ghost" size="sm" asChild className="h-8 px-2.5">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                  PDF
                </a>
              </Button>
            )}
            {riksdagenUrl && (
              <Button variant="ghost" size="sm" asChild className="h-8 px-2.5">
                <a href={riksdagenUrl} target="_blank" rel="noopener noreferrer">
                  <Building2 className="h-3.5 w-3.5 mr-1" />
                  Riksdagen
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Document content */}
        <div className="p-6 md:p-8">
          {/* Header - shown for both HTML and fallback modes */}
          <header className="mb-8">
            {/* SFS number as main heading */}
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {amendment.document_number}
            </h1>

            {/* Subtitle - italic style like Notisum */}
            <p className="text-lg text-muted-foreground italic mt-1">
              {amendment.title}
            </p>

            {/* Document type badge - AC3 requirement */}
            <Badge variant="secondary" className="mt-3 text-xs">
              Ändringsförfattning
            </Badge>

            {/* Effective date if available */}
            {details?.effective_date && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Träder i kraft {formatDate(details.effective_date)}</span>
              </div>
            )}

            {/* Base law reference */}
            {baseLaw && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Ändrar: </span>
                <Link
                  href={`${basePath}/${baseLaw.slug}`}
                  className="text-primary hover:underline font-medium"
                >
                  {baseLaw.title}
                </Link>
              </div>
            )}
          </header>

          {/* PRIMARY: Render LLM-generated HTML content directly */}
          {hasHtmlContent && (
            <HtmlContentRenderer html={amendment.html_content!} />
          )}

          {/* FALLBACK: Parse and render full_text if no html_content */}
          {!hasHtmlContent && (
            <>
              {/* Section content - Notisum style */}
              {parsedStructure?.sections && parsedStructure.sections.length > 0 && (
                <div className="space-y-8">
                  {parsedStructure.sections.map((section, idx) => {
                    const changeType = getSectionChangeType(section.sectionNumber)
                    const config = changeType ? changeTypeConfig[changeType] : null
                    // Check if this is the first section with this chapter
                    const prevSection = parsedStructure.sections[idx - 1]
                    const showChapter = section.chapter && section.chapter !== prevSection?.chapter
                    // Check if this is the first section with this group header
                    const showGroupHeader = section.groupHeader && section.groupHeader !== prevSection?.groupHeader

                    return (
                      <div key={idx}>
                        {/* Chapter heading */}
                        {showChapter && (
                          <h2 className="font-bold text-lg mt-6 mb-4 text-foreground">
                            {section.chapter}
                          </h2>
                        )}

                        {/* Group header (Notisum-style) */}
                        {showGroupHeader && (
                          <h4 className="font-semibold text-sm text-muted-foreground mt-4 mb-3 uppercase tracking-wide">
                            {section.groupHeader}
                          </h4>
                        )}

                        {/* Section header with change badge and footnote refs */}
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-base text-primary">
                            {baseLaw ? (
                              <Link
                                href={`${basePath}/${baseLaw.slug}#${section.sectionNumber.replace(/\s+/g, '-')}`}
                                className="hover:underline"
                              >
                                {section.sectionNumber}
                              </Link>
                            ) : (
                              section.sectionNumber
                            )}
                          </h3>
                          {section.footnoteRefs && section.footnoteRefs.length > 0 && (
                            <sup className="text-xs text-muted-foreground">
                              {section.footnoteRefs.join(' ')}
                            </sup>
                          )}
                          {config && (
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium ${config.badgeClass}`}
                            >
                              {config.labelShort}
                            </Badge>
                          )}
                        </div>

                        {/* Lead text */}
                        {section.leadText && (
                          <p className="text-foreground leading-relaxed mb-3">
                            <LinkedText text={section.leadText} basePath={basePath} />
                          </p>
                        )}

                        {/* Definition list (if present) */}
                        {section.definitions && section.definitions.length > 0 ? (
                          <DefinitionListDisplay
                            definitions={section.definitions}
                            basePath={basePath}
                          />
                        ) : section.items && section.items.length > 0 ? (
                          /* Structured list items */
                          <div className="space-y-2">
                            {section.items.map((item, itemIdx) => (
                              <ListItemDisplay
                                key={itemIdx}
                                item={item}
                                basePath={basePath}
                              />
                            ))}
                          </div>
                        ) : (
                          !section.leadText && (
                            <p className="text-foreground leading-relaxed">
                              <LinkedText text={section.text} basePath={basePath} />
                            </p>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fallback: formatted text if no parsed sections */}
              {(!parsedStructure?.sections ||
                parsedStructure.sections.length === 0) &&
                formattedText && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground bg-transparent p-0 m-0">
                      {formattedText}
                    </pre>
                  </div>
                )}

              {/* Transition provisions */}
              {parsedStructure?.transitionProvisions &&
                parsedStructure.transitionProvisions.length > 0 && (
                  <div className="mt-10 pt-6 border-t">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                      Ikraftträdande- och övergångsbestämmelser
                    </h3>
                    <div className="space-y-2">
                      {parsedStructure.transitionProvisions.map((provision, idx) => (
                        <div
                          key={idx}
                          className="flex gap-3 text-sm text-foreground/80 leading-relaxed"
                        >
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {provision.number}
                          </span>
                          <span>
                            <LinkedText text={provision.text} basePath={basePath} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </article>

      {/* Change summary badges - compact footer */}
      {sectionChanges.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Ändringar:</span>
          {Object.entries(
            sectionChanges.reduce(
              (acc, change) => {
                acc[change.change_type] = (acc[change.change_type] || 0) + 1
                return acc
              },
              {} as Record<SectionChangeType, number>
            )
          ).map(([type, count]) => {
            const config = changeTypeConfig[type as SectionChangeType]
            return (
              <Badge
                key={type}
                variant="outline"
                className={`text-xs ${config.badgeClass}`}
              >
                {count} {config.label.toLowerCase()}
              </Badge>
            )
          })}
        </div>
      )}

      {/* Subject tags */}
      {amendment.subjects.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {amendment.subjects.map((subject) => (
            <Badge
              key={subject.subject_code}
              variant="secondary"
              className="text-xs font-normal"
            >
              {subject.subject_name}
            </Badge>
          ))}
        </div>
      )}

      {/* Source footer */}
      <footer className="mt-6 text-center text-xs text-muted-foreground">
        <p>
          Källa:{' '}
          <a
            href={riksdagenUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Svensk författningssamling
          </a>
        </p>
      </footer>
    </div>
  )
}

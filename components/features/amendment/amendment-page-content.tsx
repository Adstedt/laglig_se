'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Plus,
  Minus,
  Edit,
  FileDown,
  CalendarDays,
  BookOpen,
  Info,
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
import { DocumentContent } from '@/components/features/document-content'
import { DocumentHero } from '@/components/features/document-hero'
import { DocumentIntroAccordion } from '@/components/features/document-intro'

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

/** Render text with SFS references as clickable links */
function LinkedText({ text, basePath }: { text: string; basePath: string }) {
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

/** Render a list item with optional sub-items (Notisum style) */
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

/** Render a definition list (term → section reference) like Notisum */
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
  const getSectionChangeType = (
    sectionNum: string
  ): SectionChangeType | null => {
    const change = sectionChanges.find((c) => c.section === sectionNum)
    return change?.change_type ?? null
  }

  const formattedEffectiveDate = formatDate(details?.effective_date)
  const formattedPublicationDate = formatDate(amendment.publication_date)

  const quickInfoItems = formattedPublicationDate
    ? [
        {
          icon: CalendarDays,
          label: `Publicerad ${formattedPublicationDate}`,
        },
      ]
    : []

  const actionLinks = [
    ...(pdfUrl
      ? [
          {
            href: pdfUrl,
            label: 'PDF',
            icon: FileDown,
            showExternalIcon: false,
          },
        ]
      : []),
    ...(riksdagenUrl
      ? [
          {
            href: riksdagenUrl,
            label: 'Riksdagen',
            icon: Building2,
          },
        ]
      : []),
  ]

  const extraBadges = formattedEffectiveDate ? (
    <Badge
      variant="outline"
      className="border-green-200 text-green-700 dark:border-green-800 dark:text-green-400 text-xs"
    >
      Ikraft {formattedEffectiveDate}
    </Badge>
  ) : null

  return (
    <>
      <DocumentHero
        title={amendment.title}
        documentNumber={amendment.document_number}
        contentType="SFS_AMENDMENT"
        extraBadges={extraBadges}
        quickInfoItems={quickInfoItems}
        actionLinks={actionLinks}
      />

      {/* Base law reference — accordion item, matches modal grammar */}
      {baseLaw && (
        <DocumentIntroAccordion
          defaultValue={[]}
          items={[
            {
              value: 'metadata',
              label: (
                <>
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Detaljer
                </>
              ),
              children: (
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-40 shrink-0 text-muted-foreground">
                      Grundförfattning:
                    </dt>
                    <dd className="min-w-0 flex-1 font-medium">
                      <Link
                        href={`${basePath}/${baseLaw.slug}`}
                        className="inline-flex items-baseline gap-1.5 text-primary hover:underline"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
                        <span>{baseLaw.title}</span>
                      </Link>
                    </dd>
                  </div>
                  {details?.effective_date && (
                    <div className="flex gap-3">
                      <dt className="w-40 shrink-0 text-muted-foreground">
                        Träder i kraft:
                      </dt>
                      <dd className="min-w-0 flex-1 font-medium">
                        {formattedEffectiveDate}
                      </dd>
                    </div>
                  )}
                </dl>
              ),
            },
          ]}
        />
      )}

      {/* Subject Tags */}
      {amendment.subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {amendment.subjects.map((subject) => (
            <Badge
              key={subject.subject_code}
              variant="outline"
              className="text-xs"
            >
              {subject.subject_name}
            </Badge>
          ))}
        </div>
      )}

      {/* Primary: LLM-generated HTML via shared DocumentContent (TOC + tables + styling) */}
      {hasHtmlContent && (
        <DocumentContent
          htmlContent={amendment.html_content}
          isWorkspace={isWorkspace}
          className="rounded-lg bg-card p-6 md:p-10"
        />
      )}

      {/* Fallback: structured rendering from parsed full_text */}
      {!hasHtmlContent && (
        <DocumentContent className="rounded-lg bg-card p-6 md:p-10">
          {parsedStructure?.sections && parsedStructure.sections.length > 0 && (
            <div className="space-y-8">
              {parsedStructure.sections.map((section, idx) => {
                const changeType = getSectionChangeType(section.sectionNumber)
                const config = changeType ? changeTypeConfig[changeType] : null
                const prevSection = parsedStructure.sections[idx - 1]
                const showChapter =
                  section.chapter && section.chapter !== prevSection?.chapter
                const showGroupHeader =
                  section.groupHeader &&
                  section.groupHeader !== prevSection?.groupHeader

                return (
                  <div key={idx}>
                    {showChapter && (
                      <h2 className="font-bold text-lg mt-6 mb-4 text-foreground">
                        {section.chapter}
                      </h2>
                    )}
                    {showGroupHeader && (
                      <h4 className="font-semibold text-sm text-muted-foreground mt-4 mb-3 uppercase tracking-wide">
                        {section.groupHeader}
                      </h4>
                    )}
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
                      {section.footnoteRefs &&
                        section.footnoteRefs.length > 0 && (
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

                    {section.leadText && (
                      <p className="text-foreground leading-relaxed mb-3">
                        <LinkedText
                          text={section.leadText}
                          basePath={basePath}
                        />
                      </p>
                    )}

                    {section.definitions && section.definitions.length > 0 ? (
                      <DefinitionListDisplay
                        definitions={section.definitions}
                        basePath={basePath}
                      />
                    ) : section.items && section.items.length > 0 ? (
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

          {/* Fallback: formatted text */}
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
                  {parsedStructure.transitionProvisions.map(
                    (provision, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 text-sm text-foreground/80 leading-relaxed"
                      >
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {provision.number}
                        </span>
                        <span>
                          <LinkedText
                            text={provision.text}
                            basePath={basePath}
                          />
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </DocumentContent>
      )}

      {/* Change summary badges */}
      {sectionChanges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Källa:{' '}
          <a
            href={riksdagenUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Riksdagen (Svensk författningssamling)
          </a>
        </p>
      </footer>
    </>
  )
}

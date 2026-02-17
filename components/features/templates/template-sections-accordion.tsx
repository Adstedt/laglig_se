'use client'

import { useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  SOURCE_TYPE_ICON_BADGE_COLORS,
  DEFAULT_ICON_BADGE_COLOR,
} from '@/lib/constants/template-domains'
import { cn } from '@/lib/utils'
import type {
  TemplateDetailSection,
  TemplateDetailItem,
} from '@/lib/db/queries/template-catalog'

interface TemplateSectionsAccordionProps {
  sections: TemplateDetailSection[]
}

/** Colors for section number badges — cycles through these for visual rhythm */
const SECTION_NUMBER_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
]

/**
 * Splits a long paragraph into shorter segments at sentence boundaries
 * for improved readability. Only splits if the paragraph exceeds ~200 chars.
 */
function splitLongParagraph(text: string): string[] {
  if (text.length < 200) return [text]
  // Split at sentence endings (. followed by space + capital letter)
  const sentences = text.split(/(?<=\.)\s+(?=[A-ZÅÄÖ])/)
  if (sentences.length <= 2) return [text]
  // Group into chunks of 2-3 sentences
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '))
  }
  return chunks
}

/**
 * Renders text with smart formatting:
 * - Detects `\n- ` bullet patterns → styled list
 * - Splits long paragraphs at sentence boundaries for readability
 * - Separates paragraphs on double-newline
 */
function FormattedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const paragraphs = text.split(/\n\n/)

  return (
    <div className={cn('space-y-3 max-w-4xl', className)}>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n')
        const bulletLines = lines.filter((l) => /^[-–•]\s/.test(l.trim()))

        // If most lines are bullets, render as a list
        if (bulletLines.length > 1) {
          const intro = lines.filter((l) => !/^[-–•]\s/.test(l.trim()))
          return (
            <div key={i}>
              {intro.length > 0 && <p className="mb-2">{intro.join(' ')}</p>}
              <ul className="space-y-1.5 ml-1">
                {bulletLines.map((line, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="text-muted-foreground/50 shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-current block" />
                    <span>{line.replace(/^[-–•]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }

        // Long paragraph: split at sentence boundaries
        const chunks = splitLongParagraph(para)
        if (chunks.length > 1) {
          return (
            <div key={i} className="space-y-2">
              {chunks.map((chunk, j) => (
                <p key={j}>{chunk}</p>
              ))}
            </div>
          )
        }

        return <p key={i}>{para}</p>
      })}
    </div>
  )
}

function SectionItemRow({ item }: { item: TemplateDetailItem }) {
  const [expanded, setExpanded] = useState(false)

  const Icon = item.source_type
    ? (SOURCE_TYPE_ICONS[item.source_type] ?? FileText)
    : FileText
  const typeLabel = item.source_type
    ? (SOURCE_TYPE_LABELS[item.source_type] ?? item.source_type)
    : null
  const iconColor = item.source_type
    ? (SOURCE_TYPE_ICON_BADGE_COLORS[item.source_type] ??
      DEFAULT_ICON_BADGE_COLOR)
    : DEFAULT_ICON_BADGE_COLOR

  const hasContent = !!item.compliance_summary || !!item.expert_commentary
  const hasBothTabs = !!item.compliance_summary && !!item.expert_commentary

  return (
    <>
      <tr
        className={cn(
          'border-b transition-colors bg-background hover:bg-muted/50',
          hasContent && 'cursor-pointer',
          expanded && 'border-b-0'
        )}
        onClick={hasContent ? () => setExpanded(!expanded) : undefined}
      >
        {/* Type icon badge */}
        <td className="p-4 pr-2 w-[60px] align-middle">
          <div
            className={cn(
              'inline-flex items-center justify-center w-8 h-8 rounded',
              iconColor
            )}
            title={typeLabel ?? undefined}
          >
            <Icon className="h-4 w-4" />
          </div>
        </td>

        {/* Document title + number */}
        <td className="p-4 pl-2 align-middle">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground block truncate">
                {item.document.title}
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                {item.document.document_number}
              </span>
            </div>
            {hasContent && (
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-200',
                  expanded && 'rotate-90'
                )}
              />
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row with tabs */}
      {expanded && hasContent && (
        <tr className="border-b">
          <td />
          <td className="pb-5 pt-1 pl-2 pr-4">
            <div className="rounded-lg border bg-background p-4">
              {hasBothTabs ? (
                <Tabs defaultValue="krav" className="w-full">
                  <TabsList className="h-8 p-0.5">
                    <TabsTrigger value="krav" className="text-xs px-3 h-7">
                      Krav
                    </TabsTrigger>
                    <TabsTrigger value="om-lagen" className="text-xs px-3 h-7">
                      Om lagen
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="krav">
                    <FormattedText
                      text={item.compliance_summary!}
                      className="text-sm text-foreground leading-relaxed"
                    />
                  </TabsContent>
                  <TabsContent value="om-lagen">
                    <FormattedText
                      text={item.expert_commentary!}
                      className="text-sm text-foreground leading-relaxed"
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <FormattedText
                  text={(item.compliance_summary ?? item.expert_commentary)!}
                  className="text-sm text-foreground leading-relaxed"
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function SectionItemTable({ items }: { items: TemplateDetailItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 px-4">
        Inga dokument i denna sektion ännu
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="h-10 px-4 pr-2 w-[60px] text-xs font-medium text-muted-foreground align-middle">
              Typ
            </th>
            <th className="h-10 px-4 pl-2 text-xs font-medium text-muted-foreground align-middle">
              Dokument
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <SectionItemRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TemplateSectionsAccordion({
  sections,
}: TemplateSectionsAccordionProps) {
  // Single-section case: render flat list without accordion chrome
  if (sections.length === 1) {
    const section = sections[0]!
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">{section.name}</h2>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {section.description}
            </p>
          )}
        </div>
        <div className="rounded-lg border">
          <SectionItemTable items={section.items} />
        </div>
        <p className="text-xs text-muted-foreground italic">
          Sektionsindelning kommer snart
        </p>
      </div>
    )
  }

  // Multi-section case: full accordion
  return (
    <Accordion type="multiple" className="w-full">
      {sections.map((section, index) => {
        const numberColor =
          SECTION_NUMBER_COLORS[index % SECTION_NUMBER_COLORS.length]!

        return (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left flex-1 mr-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${numberColor}`}
                >
                  {section.section_number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{section.name}</span>
                    <Badge
                      variant="secondary"
                      className="text-xs py-0 px-1.5 shrink-0"
                    >
                      {section.item_count} dokument
                    </Badge>
                  </div>
                  {section.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border mt-1">
                <SectionItemTable items={section.items} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

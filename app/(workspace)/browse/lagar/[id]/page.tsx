import { notFound } from 'next/navigation'
import { DocumentStatus } from '@prisma/client'
import type { Metadata } from 'next'
import sanitizeHtml from 'sanitize-html'
import { getCachedLaw, getCachedLawMetadata } from '@/lib/cache/cached-queries'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  Building2,
  ExternalLink,
  Info,
  Link2,
  FileText,
} from 'lucide-react'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { FloatingReferencesWrapper } from '@/app/(public)/lagar/[id]/floating-references-wrapper'
import {
  LawDocumentContent,
  NotYetInForceBanner,
  RelatedDocsPrefetcher,
  TimelinePrefetcher,
} from '@/components/features/law'
import { VersionSelector } from '@/components/features/law-versions'
import {
  DocumentHero,
  type DocumentStatusBadge,
} from '@/components/features/document-hero'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { DocumentIntroAccordion } from '@/components/features/document-intro'
import { RelatedDocumentsSummary } from '@/components/features/cross-references'
import { getImplementedEuDirectives } from '@/app/actions/cross-references'
import { cleanLawHtml } from '@/lib/sfs/clean-law-html'
import { getLatestAmendmentSfs } from '@/lib/sfs/latest-amendment'
import { AddToLawListButton } from '@/components/features/documents/add-to-law-list-button'
import { getListsContainingDocument } from '@/app/actions/document-list'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const law = await getCachedLawMetadata(id)

  if (!law) {
    return { title: 'Lag hittades inte' }
  }

  return {
    title: `${law.title} - ${law.document_number}`,
    description:
      law.summary?.substring(0, 155) ||
      `Läs ${law.title} i sin helhet på Laglig.se`,
  }
}

interface LawMetadata {
  department?: string
  issuedDate?: string
  amendedThrough?: string
  repealedDate?: string
  repealedBy?: string
  sfsrUrl?: string
  fulltextUrl?: string
  effectiveDate?: string
  effectiveDateFormatted?: string
  isNotYetInForce?: boolean
}

function extractLawMetadata(html: string): LawMetadata {
  const metadata: LawMetadata = {}
  const hrIndex = html.indexOf('<hr')
  if (hrIndex === -1) return metadata

  const metaBlock = html.substring(0, hrIndex)
  const deptMatch = metaBlock.match(
    /Departement\/myndighet<\/(?:b|strong)>:\s*\n?\s*([^<\n]+)/i
  )
  if (deptMatch?.[1]) metadata.department = deptMatch[1].trim()

  const issuedMatch = metaBlock.match(
    /Utfärdad<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (issuedMatch?.[1]) metadata.issuedDate = issuedMatch[1]

  const amendedMatch = metaBlock.match(
    /Ändrad<\/(?:b|strong)>:\s*\n?\s*t\.o\.m\.?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (amendedMatch?.[1]) metadata.amendedThrough = amendedMatch[1]

  const repealedMatch = metaBlock.match(
    /Upphävd<\/(?:b|strong)>:\s*\n?\s*(\d{4}-\d{2}-\d{2})/i
  )
  if (repealedMatch?.[1]) metadata.repealedDate = repealedMatch[1]

  const repealedByMatch = metaBlock.match(
    /har upphävts genom<\/(?:b|strong)>:\s*\n?\s*(?:SFS\s*)?(\d{4}:\d+)/i
  )
  if (repealedByMatch?.[1]) metadata.repealedBy = repealedByMatch[1]

  const sfsrMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfsr[^"]+)"/i
  )
  if (sfsrMatch?.[1]) metadata.sfsrUrl = sfsrMatch[1]

  const fulltextMatch = metaBlock.match(
    /href="(https?:\/\/rkrattsbaser\.gov\.se\/sfst[^"]+)"/i
  )
  if (fulltextMatch?.[1]) metadata.fulltextUrl = fulltextMatch[1]

  const afterHr = html.substring(hrIndex)
  const firstSectionEnd = afterHr.indexOf('<a class="paragraf"')
  const altSectionEnd = afterHr.indexOf('<h3 name="K')
  const sectionEnd =
    firstSectionEnd > 0
      ? firstSectionEnd
      : altSectionEnd > 0
        ? altSectionEnd
        : 3000
  const firstSection = afterHr.substring(0, sectionEnd)

  const effectiveDateMatch = firstSection.match(
    /\/Träder i kraft I:(\d{4})-(\d{2})-(\d{2})(?:\/|<)/
  )
  if (effectiveDateMatch) {
    const year = parseInt(effectiveDateMatch[1] ?? '0')
    const month = parseInt(effectiveDateMatch[2] ?? '0')
    const day = parseInt(effectiveDateMatch[3] ?? '0')

    metadata.effectiveDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

    const effectiveDate = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    metadata.effectiveDateFormatted = effectiveDate.toLocaleDateString(
      'sv-SE',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )

    metadata.isNotYetInForce = effectiveDate > today
  }

  return metadata
}

function formatDateOrNull(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('sv-SE', options)
}

function resolveStatusBadge(
  status: DocumentStatus,
  isNotYetInForce: boolean,
  effectiveDateLabel: string | undefined
): DocumentStatusBadge | undefined {
  if (isNotYetInForce && effectiveDateLabel) {
    return { kind: 'not-in-force', effectiveDateLabel }
  }
  switch (status) {
    case 'ACTIVE':
      return { kind: 'active' }
    case 'REPEALED':
      return { kind: 'repealed' }
    case 'DRAFT':
      return { kind: 'draft' }
    case 'ARCHIVED':
      return { kind: 'archived' }
    default:
      return undefined
  }
}

export default async function WorkspaceLawPage({ params }: PageProps) {
  const { id } = await params
  const law = await getCachedLaw(id)

  if (!law) {
    notFound()
  }

  const implementedDirectives = await getImplementedEuDirectives(law.id)

  const cleanedHtml = law.html_content ? cleanLawHtml(law.html_content) : null
  const sanitizedHtml = cleanedHtml
    ? sanitizeHtml(cleanedHtml, {
        allowedTags: [
          'article',
          'section',
          'details',
          'summary',
          'footer',
          'nav',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'p',
          'br',
          'hr',
          'ul',
          'ol',
          'li',
          'dl',
          'dt',
          'dd',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'a',
          'strong',
          'em',
          'span',
          'div',
          'blockquote',
          'pre',
          'code',
          'b',
          'i',
          'u',
          'sub',
          'sup',
        ],
        allowedAttributes: {
          a: ['href', 'name', 'class', 'title', 'target', 'rel'],
          '*': ['class', 'id', 'name'],
        },
      })
    : null

  const formattedPublicationDate = formatDateOrNull(law.publication_date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lawMetadata = law.html_content
    ? extractLawMetadata(law.html_content)
    : {}

  // Resolve "Ändrad t.o.m." — prefer tracked amendments, fall back to HTML
  // extraction (older laws embed this in `<hr>`+<b>-format HTML; newer
  // `.lovhead`-format laws don't).
  const amendedThroughSfs =
    getLatestAmendmentSfs(law.base_amendments) ??
    (lawMetadata.amendedThrough ? `SFS ${lawMetadata.amendedThrough}` : null)

  const statusBadge = resolveStatusBadge(
    law.status,
    lawMetadata.isNotYetInForce ?? false,
    lawMetadata.effectiveDateFormatted
  )

  const ctx = await getWorkspaceContext()
  const canAddToList = hasPermission(ctx.role, 'documents:add')
  const listIdsContaining = canAddToList
    ? ((await getListsContainingDocument(law.id)).data ?? [])
    : []

  return (
    <DocumentPageLayout isWorkspace>
      <BreadcrumbOverride label={law.document_number} />

      {/* Banner for laws not yet in force */}
      {lawMetadata.isNotYetInForce && lawMetadata.effectiveDateFormatted && (
        <NotYetInForceBanner
          effectiveDate={lawMetadata.effectiveDateFormatted}
          title={law.title}
        />
      )}

      {/* Hero Header */}
      <DocumentHero
        title={law.title}
        documentNumber={law.document_number}
        contentType="SFS_LAW"
        status={statusBadge}
        extraBadges={
          amendedThroughSfs ? (
            <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Ändrad t.o.m. {amendedThroughSfs}
            </span>
          ) : undefined
        }
        quickInfoItems={
          formattedPublicationDate
            ? [
                {
                  icon: CalendarDays,
                  label: `Publicerad ${formattedPublicationDate}`,
                },
              ]
            : []
        }
        actionLinks={
          law.source_url
            ? [
                {
                  href: law.source_url,
                  label: 'Riksdagen',
                  icon: Building2,
                  external: true,
                },
              ]
            : []
        }
        actions={
          canAddToList ? (
            <AddToLawListButton
              documentId={law.id}
              initialListIdsContaining={listIdsContaining}
            />
          ) : undefined
        }
      />

      {/* Version selector */}
      <div className="flex justify-end">
        <VersionSelector
          lawSlug={law.slug}
          lawSfs={law.document_number.replace(/^SFS\s*/, '')}
          isWorkspace
        />
      </div>

      {/* Intro accordion — Sammanfattning, Detaljer, Relaterade dokument */}
      <DocumentIntroAccordion
        defaultValue={[]}
        items={[
          ...(law.summary
            ? [
                {
                  value: 'summary',
                  label: (
                    <>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Sammanfattning
                    </>
                  ),
                  children: (
                    <p className="leading-relaxed text-foreground/90">
                      {law.summary}
                    </p>
                  ),
                },
              ]
            : []),
          ...(lawMetadata.department ||
          lawMetadata.issuedDate ||
          lawMetadata.sfsrUrl ||
          lawMetadata.repealedDate
            ? [
                {
                  value: 'metadata',
                  label: (
                    <>
                      <Info className="h-4 w-4 text-muted-foreground" />
                      Detaljer
                    </>
                  ),
                  children: (
                    <>
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        {lawMetadata.department && (
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">
                              Departement:
                            </dt>
                            <dd className="font-medium">
                              {lawMetadata.department}
                            </dd>
                          </div>
                        )}
                        {lawMetadata.issuedDate && (
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">
                              Utfärdad:
                            </dt>
                            <dd className="font-medium">
                              {lawMetadata.issuedDate}
                            </dd>
                          </div>
                        )}
                        {/* Ändrad t.o.m. is now in the hero pill — dropped here to avoid duplication */}
                        {lawMetadata.repealedDate && (
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">
                              Upphävd:
                            </dt>
                            <dd className="font-medium text-red-600">
                              {lawMetadata.repealedDate}
                            </dd>
                          </div>
                        )}
                        {lawMetadata.repealedBy && (
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted-foreground">
                              Upphävd genom:
                            </dt>
                            <dd className="font-medium">
                              SFS {lawMetadata.repealedBy}
                            </dd>
                          </div>
                        )}
                      </dl>
                      {(lawMetadata.sfsrUrl || lawMetadata.fulltextUrl) && (
                        <div className="mt-3 flex flex-wrap gap-4 border-t border-border/60 pt-3 text-sm">
                          {lawMetadata.sfsrUrl && (
                            <a
                              href={lawMetadata.sfsrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            >
                              Ändringsregister (SFSR)
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {lawMetadata.fulltextUrl && (
                            <a
                              href={lawMetadata.fulltextUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            >
                              Fulltext (Regeringskansliet)
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  ),
                },
              ]
            : []),
          ...(implementedDirectives.length > 0 || law.base_amendments.length > 0
            ? [
                {
                  value: 'related',
                  label: (
                    <>
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      Relaterade dokument
                    </>
                  ),
                  hint:
                    law.base_amendments.length > 0
                      ? `${law.base_amendments.length} ändringar`
                      : undefined,
                  children: (
                    <RelatedDocumentsSummary
                      implementedDirectives={implementedDirectives}
                      amendments={law.base_amendments.map((a) => ({
                        id: a.id,
                        title: a.amending_law_title,
                        slug: a.amending_document?.slug ?? null,
                        effectiveDate: a.effective_date
                          ? typeof a.effective_date === 'string'
                            ? a.effective_date
                            : a.effective_date.toISOString()
                          : null,
                      }))}
                      lawTitle={law.title}
                      lawSlug={law.slug}
                      isWorkspace
                      embedded
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* Subject tags — flat row */}
      {law.subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {law.subjects.map((subject) => (
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

      {/* Law Content with Future Amendments Banner */}
      <LawDocumentContent
        htmlContent={sanitizedHtml ?? ''}
        fallbackText={law.full_text}
        sourceUrl={law.source_url}
        isLawNotYetInForce={lawMetadata.isNotYetInForce ?? false}
        isWorkspace
      />

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Källa:{' '}
          <a
            href={law.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Riksdagen (Svensk författningssamling)
          </a>
        </p>
      </footer>

      <BackToTopButton />

      <FloatingReferencesWrapper
        directiveCount={implementedDirectives.length}
      />

      <RelatedDocsPrefetcher
        implementedDirectives={implementedDirectives.map((d) => ({
          slug: d.slug,
        }))}
        amendments={law.base_amendments
          .filter((a) => a.amending_document?.slug)
          .map((a) => ({
            slug: a.amending_document?.slug ?? null,
          }))}
      />
      <TimelinePrefetcher lawSfs={law.document_number} lawSlug={law.slug} />
    </DocumentPageLayout>
  )
}

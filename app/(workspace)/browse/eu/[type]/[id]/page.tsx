import { notFound } from 'next/navigation'
import { ContentType } from '@prisma/client'
import type { Metadata } from 'next'
import {
  getCachedEuLegislation,
  getCachedEuLegislationMetadata,
} from '@/lib/cache/cached-queries'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, ExternalLink, FileText } from 'lucide-react'
import { LinkedSwedishLaws } from '@/components/features/cross-references'
import { lookupLawBySfsNumber } from '@/app/actions/cross-references'
import { DocumentContent } from '@/components/features/document-content'
import { DocumentHero } from '@/components/features/document-hero'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { DocumentIntroAccordion } from '@/components/features/document-intro'
import { BackToTopButton } from '@/app/(public)/lagar/[id]/toc-client'
import { FloatingImplementationsButton } from '@/app/(public)/eu/[type]/[id]/floating-implementations-button'
import { RelatedDocsPrefetcher } from '@/components/features/eu-legislation'
import { AddToLawListButton } from '@/components/features/documents/add-to-law-list-button'
import { getListsContainingDocument } from '@/app/actions/document-list'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'

const EU_TYPE_MAP: Record<
  string,
  { contentType: ContentType; name: string; namePlural: string }
> = {
  forordningar: {
    contentType: ContentType.EU_REGULATION,
    name: 'EU-förordning',
    namePlural: 'EU-förordningar',
  },
  direktiv: {
    contentType: ContentType.EU_DIRECTIVE,
    name: 'EU-direktiv',
    namePlural: 'EU-direktiv',
  },
}

interface PageProps {
  params: Promise<{ type: string; id: string }>
}

function formatDateOrNull(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string | null {
  if (!date) return null
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('sv-SE', options)
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type, id } = await params

  const typeInfo = EU_TYPE_MAP[type]
  if (!typeInfo) {
    return { title: 'EU-dokument hittades inte' }
  }

  const document = await getCachedEuLegislationMetadata(
    id,
    typeInfo.contentType
  )

  if (!document) {
    return { title: 'EU-dokument hittades inte' }
  }

  return {
    title: `${document.title}`,
    description:
      document.summary?.substring(0, 155) ||
      `Läs ${document.title} i sin helhet`,
  }
}

export default async function WorkspaceEuDocumentPage({ params }: PageProps) {
  const { type, id } = await params

  const typeInfo = EU_TYPE_MAP[type]
  if (!typeInfo) {
    notFound()
  }

  const document = await getCachedEuLegislation(id, typeInfo.contentType)

  if (!document) {
    notFound()
  }

  const euDoc = document.eu_document

  // Parse national implementation measures
  const nimData = euDoc?.national_implementation_measures as {
    sweden?: {
      measures: Array<{
        sfs_number: string
        title: string
      }>
    }
  } | null

  const measuresWithSlugs = await Promise.all(
    (nimData?.sweden?.measures || []).map(async (measure) => {
      const lawInfo = await lookupLawBySfsNumber(measure.sfs_number)
      return {
        sfs_number: measure.sfs_number,
        title: measure.title || lawInfo?.title,
        slug: lawInfo?.slug ?? null,
      }
    })
  )

  const formattedPublicationDate = formatDateOrNull(document.publication_date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const extraBadges = (
    <>
      {euDoc?.celex_number && (
        <Badge variant="outline" className="text-xs">
          CELEX: {euDoc.celex_number}
        </Badge>
      )}
      {euDoc?.eut_reference && (
        <Badge variant="outline" className="text-xs">
          EUT: {euDoc.eut_reference}
        </Badge>
      )}
    </>
  )

  const quickInfoItems = [
    { icon: FileText, label: document.document_number },
    ...(formattedPublicationDate
      ? [
          {
            icon: CalendarDays,
            label: `Publicerad ${formattedPublicationDate}`,
          },
        ]
      : []),
  ]

  const actionLinks = document.source_url
    ? [
        {
          href: document.source_url,
          label: 'EUR-Lex',
          icon: ExternalLink,
          showExternalIcon: false,
        },
      ]
    : []

  const ctx = await getWorkspaceContext()
  const canAddToList = hasPermission(ctx.role, 'documents:add')
  const listIdsContaining = canAddToList
    ? ((await getListsContainingDocument(document.id)).data ?? [])
    : []

  return (
    <DocumentPageLayout isWorkspace>
      <BreadcrumbOverride label={document.document_number} />

      <DocumentHero
        title={document.title}
        documentNumber={document.document_number}
        contentType={typeInfo.contentType}
        typeLabel={typeInfo.name}
        extraBadges={extraBadges}
        quickInfoItems={quickInfoItems}
        actionLinks={actionLinks}
        actions={
          canAddToList ? (
            <AddToLawListButton
              documentId={document.id}
              initialListIdsContaining={listIdsContaining}
            />
          ) : undefined
        }
      />

      {/* Sammanfattning — accordion item, collapsed by default */}
      {document.summary && (
        <DocumentIntroAccordion
          defaultValue={[]}
          items={[
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
                  {document.summary}
                </p>
              ),
            },
          ]}
        />
      )}

      {/* Swedish Implementation (for directives) */}
      {type === 'direktiv' && measuresWithSlugs.length > 0 && (
        <LinkedSwedishLaws measures={measuresWithSlugs} />
      )}

      {/* Document content */}
      {document.html_content ? (
        <DocumentContent
          htmlContent={document.html_content}
          isWorkspace
          className="rounded-lg bg-card p-6 md:p-10"
        />
      ) : document.full_text ? (
        <DocumentContent
          fallbackText={document.full_text}
          className="rounded-lg bg-card p-6 md:p-10"
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="italic text-muted-foreground py-8 text-center">
              Ingen dokumenttext tillgänglig.{' '}
              <a
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Läs på EUR-Lex
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Källa:{' '}
          <a
            href={document.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            EUR-Lex (Europeiska unionens publikationsbyrå)
          </a>
        </p>
      </footer>

      <BackToTopButton />

      {type === 'direktiv' && (
        <FloatingImplementationsButton
          implementationCount={measuresWithSlugs.length}
        />
      )}

      <RelatedDocsPrefetcher
        swedishImplementations={measuresWithSlugs.map((m) => ({
          slug: m.slug,
        }))}
      />
    </DocumentPageLayout>
  )
}

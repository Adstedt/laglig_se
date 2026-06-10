import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getCachedAmendment,
  getCachedAmendmentMetadata,
} from '@/lib/cache/cached-queries'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AmendmentPageContent } from '@/components/features/amendment'
import { DocumentPageLayout } from '@/components/features/document-page-layout'
import { getDocumentTheme } from '@/lib/document-themes'
import { buildSeoDescription, documentSeoTitle } from '@/lib/seo/meta'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const amendment = await getCachedAmendmentMetadata(id)

  if (!amendment) {
    return {
      title: 'Ändringsförfattning hittades inte',
    }
  }

  const metadata = amendment.metadata as { base_law_sfs?: string } | null
  const baseLawInfo = metadata?.base_law_sfs
    ? ` som ändrar ${metadata.base_law_sfs}`
    : ''

  const title = documentSeoTitle(amendment.title, amendment.document_number)
  const description = buildSeoDescription({
    summary: amendment.summary,
    fullText: amendment.full_text,
    fallback: `Ändringsförfattning ${amendment.document_number}${baseLawInfo}. Läs ändringarna i fulltext på Laglig.se.`,
  })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${baseUrl}/lagar/andringar/${amendment.slug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/lagar/andringar/${amendment.slug}`,
    },
  }
}

export default async function AmendmentPage({ params }: PageProps) {
  const { id: slug } = await params
  const amendment = await getCachedAmendment(slug)

  if (!amendment) {
    notFound()
  }

  const theme = getDocumentTheme('SFS_AMENDMENT')
  const ThemeIcon = theme.icon
  const baseLawSlug = amendment.baseLaw?.slug

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Hem</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/lagar">Lagar</BreadcrumbLink>
        </BreadcrumbItem>
        {baseLawSlug && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/lagar/${baseLawSlug}`}>
                {amendment.baseLaw?.document_number}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        )}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-1.5">
            <ThemeIcon className={cn('h-3.5 w-3.5', theme.accent)} />
            {amendment.document_number}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )

  return (
    <DocumentPageLayout breadcrumbs={breadcrumbs}>
      <AmendmentPageContent amendment={amendment} isWorkspace={false} />
    </DocumentPageLayout>
  )
}

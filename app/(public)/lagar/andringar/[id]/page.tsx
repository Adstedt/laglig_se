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
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const amendment = await getCachedAmendmentMetadata(id)

  if (!amendment) {
    return {
      title: 'Ändringsförfattning hittades inte | Laglig.se',
    }
  }

  const metadata = amendment.metadata as { base_law_sfs?: string } | null
  const baseLawInfo = metadata?.base_law_sfs
    ? ` - ändrar ${metadata.base_law_sfs}`
    : ''

  return {
    title: `${amendment.title} | Laglig.se`,
    description:
      amendment.summary?.substring(0, 155) ||
      `Läs ${amendment.document_number}${baseLawInfo} på Laglig.se`,
    openGraph: {
      title: amendment.title,
      description:
        amendment.summary?.substring(0, 155) ||
        `Ändringsförfattning ${amendment.document_number}`,
      type: 'article',
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

  // Build breadcrumb path
  const baseLawSlug = amendment.baseLaw?.slug

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
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

        {/* Page Content */}
        <AmendmentPageContent amendment={amendment} isWorkspace={false} />
      </div>
    </main>
  )
}

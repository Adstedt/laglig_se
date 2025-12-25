import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCachedLawMetadata } from '@/lib/cache/cached-queries'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Scale, ArrowLeft } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import {
  HistoricalVersionBanner,
  VersionSelector,
} from '@/components/features/law-versions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string; date: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, date } = await params
  const law = await getCachedLawMetadata(id)

  if (!law) {
    return {
      title: 'Lag hittades inte | Laglig.se',
    }
  }

  const formattedDate = new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return {
    title: `${law.title} - Version ${formattedDate} | Laglig.se`,
    description: `Historisk version av ${law.title} (${law.document_number}) som gällde per ${formattedDate}.`,
    robots: {
      index: false, // Don't index historical versions
      follow: true,
    },
  }
}

export default async function WorkspaceHistoricalVersionPage({
  params,
}: PageProps) {
  const { id: slug, date } = await params

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    notFound()
  }

  // Get law metadata
  const law = await getCachedLawMetadata(slug)
  if (!law) {
    notFound()
  }

  // Extract SFS number without "SFS " prefix for API call
  const sfsNumber = law.document_number.replace(/^SFS\s*/, '')

  // Fetch the historical version from API
  const versionRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/laws/${encodeURIComponent(sfsNumber)}/version/${date}`,
    { cache: 'no-store' }
  )

  if (!versionRes.ok) {
    if (versionRes.status === 404) {
      notFound()
    }
    throw new Error('Failed to fetch historical version')
  }

  const version = await versionRes.json()

  // Format dates
  const formattedDate = new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Get theme for SFS laws
  const theme = getDocumentTheme('SFS_LAW')
  const ThemeIcon = theme.icon

  return (
    <div className="space-y-6">
      {/* Historical Version Banner - uses workspace link */}
      <HistoricalVersionBanner
        formattedDate={formattedDate}
        currentVersionUrl={`/browse/lagar/${slug}`}
      />

      {/* Hero Header */}
      <header className="rounded-xl bg-card p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              theme.accentLight
            )}
          >
            <ThemeIcon className={cn('h-6 w-6', theme.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl leading-tight">
              {law.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', theme.badge)}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </Badge>
              <Badge variant="secondary" className="font-mono text-sm">
                {law.document_number}
              </Badge>
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
              >
                <CalendarDays className="h-3 w-3 mr-1" />
                Historisk version
              </Badge>
            </div>
          </div>
        </div>

        {/* Version selector and navigation */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Version per:</span> {formattedDate}
          </div>
          <div className="flex items-center gap-2">
            <VersionSelector
              lawSlug={slug}
              lawSfs={sfsNumber}
              currentDate={date}
              isWorkspace
            />
          </div>
        </div>
      </header>

      {/* Version Info Card */}
      <Card>
        <CardContent className="p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">Version datum:</dt>
              <dd className="font-medium">{formattedDate}</dd>
            </div>
            {version.appliedAmendments?.length > 0 && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0">
                  Ändringar tillämpade:
                </dt>
                <dd className="font-medium">
                  {version.appliedAmendments.length} st
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground shrink-0">Paragrafer:</dt>
              <dd className="font-medium">
                {version.sections?.length || 0} st
              </dd>
            </div>
          </dl>

          {/* Navigation to compare versions - uses workspace prefix */}
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/browse/lagar/${slug}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Gällande version
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/browse/lagar/${slug}/historik`}>
                <Scale className="h-4 w-4 mr-1" />
                Visa alla versioner
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Law Content */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Lagtext (version {formattedDate})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="prose prose-sm max-w-none p-6">
            {version.sections && version.sections.length > 0 ? (
              version.sections.map(
                (
                  section: {
                    chapter: string | null
                    section: string
                    heading?: string
                    textContent: string
                  },
                  index: number
                ) => (
                  <div
                    key={`${section.chapter || '_'}-${section.section}-${index}`}
                    className="mb-6 pb-6 border-b last:border-0 last:mb-0 last:pb-0"
                  >
                    <h3 className="text-base font-semibold mb-2">
                      {section.chapter && (
                        <span className="text-muted-foreground">
                          {section.chapter} kap.{' '}
                        </span>
                      )}
                      {section.section} §
                      {section.heading && (
                        <span className="font-normal text-muted-foreground ml-2">
                          {section.heading}
                        </span>
                      )}
                    </h3>
                    <div className="whitespace-pre-wrap text-sm">
                      {section.textContent}
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Ingen lagtext tillgänglig för detta datum.</p>
                <p className="text-sm mt-2">
                  Lagen kan ha trätt i kraft efter det valda datumet, eller så
                  saknas data för denna period.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Applied Amendments */}
      {version.appliedAmendments && version.appliedAmendments.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg">
              Tillämpade ändringar ({version.appliedAmendments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {version.appliedAmendments.map(
                (amendment: { sfsNumber: string; effectiveDate: string }) => (
                  <div
                    key={amendment.sfsNumber}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium">
                      SFS {amendment.sfsNumber}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(amendment.effectiveDate).toLocaleDateString(
                        'sv-SE'
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Detta är en rekonstruerad historisk version baserad på tillgängliga
          ändringsförfattningar.
        </p>
        <p className="mt-1">
          <Link
            href={`/browse/lagar/${slug}`}
            className="text-primary hover:underline"
          >
            Gå till gällande version
          </Link>
        </p>
      </footer>
    </div>
  )
}

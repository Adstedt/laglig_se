import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCachedLawMetadata } from '@/lib/cache/cached-queries'
import { getCachedAmendmentTimeline } from '@/lib/legal-document/version-cache'
import { getPublicPdfUrl } from '@/lib/supabase/storage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { History, ArrowLeft, Info } from 'lucide-react'
import { getDocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'
import { VersionByVersionTimeline } from '@/components/features/law-versions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params
  const law = await getCachedLawMetadata(id)

  if (!law) {
    return {
      title: 'Lag hittades inte | Laglig.se',
    }
  }

  return {
    title: `Ändringshistorik - ${law.title} | Laglig.se`,
    description: `Se alla ändringar och historiska versioner av ${law.title} (${law.document_number}).`,
  }
}

export default async function WorkspaceHistoryPage({ params }: PageProps) {
  const { id: slug } = await params

  // Get law metadata
  const law = await getCachedLawMetadata(slug)
  if (!law) {
    notFound()
  }

  // Extract SFS number without "SFS " prefix
  const sfsNumber = law.document_number.replace(/^SFS\s*/, '')

  // Fetch amendment history (cached for 24h)
  const timeline = await getCachedAmendmentTimeline(sfsNumber)

  // Get theme for SFS laws
  const theme = getDocumentTheme('SFS_LAW')
  const ThemeIcon = theme.icon

  // Transform timeline for the component
  const amendments = timeline.map((a) => ({
    sfsNumber: a.sfsNumber,
    effectiveDate: a.effectiveDate?.toISOString().slice(0, 10) ?? null,
    title: a.title ?? undefined,
    sectionsChanged: a.changeTypes?.amended || 0,
    sectionsAdded: a.changeTypes?.new || 0,
    sectionsRepealed: a.changeTypes?.repealed || 0,
    pdfUrl: a.storagePath ? getPublicPdfUrl(a.storagePath) : null,
  }))

  // Derive available version dates from timeline (no separate query needed)
  const availableVersionDates = timeline
    .filter((a) => a.effectiveDate)
    .map((a) => a.effectiveDate!.toISOString().slice(0, 10))

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <header className="rounded-xl bg-card p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
              theme.accentLight
            )}
          >
            <History className={cn('h-6 w-6', theme.accent)} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl leading-tight">
              Ändringshistorik
            </h1>
            <p className="text-muted-foreground mt-1">{law.title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className={cn('gap-1', theme.badge)}>
                <ThemeIcon className="h-3.5 w-3.5" />
                {theme.label}
              </Badge>
              <Badge variant="secondary" className="font-mono text-sm">
                {law.document_number}
              </Badge>
              <Badge variant="outline">{timeline.length} ändringar</Badge>
            </div>
          </div>
        </div>

        {/* Back to law - uses workspace prefix */}
        <div className="mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/browse/lagar/${slug}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Tillbaka till lagen
            </Link>
          </Button>
        </div>
      </header>

      {/* Info banner */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Version för version</p>
            <p className="text-blue-700 dark:text-blue-300">
              Klicka på en ändringsförfattning för att se exakt vilka paragrafer
              som ändrades jämfört med föregående version.
            </p>
          </div>
        </div>
      </div>

      {/* Version-by-Version Timeline */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Ändringar över tid
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <VersionByVersionTimeline
            lawSlug={slug}
            baseLawSfs={law.document_number}
            amendments={amendments}
            maxVisible={20}
            isWorkspace
          />
        </CardContent>
      </Card>

      {/* Available Version Dates */}
      {availableVersionDates.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-base">
              Hoppa till version ({availableVersionDates.length} tillgängliga)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {availableVersionDates.map((date: string) => (
                <Link key={date} href={`/browse/lagar/${slug}/version/${date}`}>
                  <Badge
                    variant="outline"
                    className="hover:bg-primary/10 cursor-pointer"
                  >
                    {new Date(date).toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <footer className="text-center text-sm text-muted-foreground py-4 border-t">
        <p>
          Ändringshistorik baserad på insamlade ändringsförfattningar från 1998
          och framåt.
        </p>
      </footer>
    </div>
  )
}

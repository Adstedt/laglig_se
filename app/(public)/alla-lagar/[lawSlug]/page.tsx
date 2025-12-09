import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ lawSlug: string }>
}

// ISR: Revalidate every hour - NOT generateStaticParams() for 11K+ docs
export const revalidate = 3600
export const dynamicParams = true

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { lawSlug } = await params
  const law = await prisma.legalDocument.findUnique({
    where: { slug: lawSlug },
    select: {
      title: true,
      document_number: true,
      summary: true,
      full_text: true,
    },
  })

  if (!law) {
    return {
      title: 'Lag hittades inte | Laglig.se',
    }
  }

  const description =
    law.summary || law.full_text?.substring(0, 155) || law.title
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    title: `${law.title} - ${law.document_number} | Laglig.se`,
    description,
    openGraph: {
      title: law.title,
      description,
      type: 'article',
      url: `${baseUrl}/alla-lagar/${lawSlug}`,
      siteName: 'Laglig.se',
    },
    twitter: {
      card: 'summary_large_image',
      title: law.title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/alla-lagar/${lawSlug}`,
    },
  }
}

export default async function LawDetailPage({ params }: PageProps) {
  const { lawSlug } = await params

  const law = await prisma.legalDocument.findUnique({
    where: { slug: lawSlug },
  })

  if (!law) {
    notFound()
  }

  const formattedDate = law.publication_date
    ? new Date(law.publication_date).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-600">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-gray-900 hover:underline">
              Hem
            </Link>
          </li>
          <li aria-hidden="true">→</li>
          <li>
            <Link
              href="/alla-lagar"
              className="hover:text-gray-900 hover:underline"
            >
              Alla lagar
            </Link>
          </li>
          <li aria-hidden="true">→</li>
          <li aria-current="page" className="text-gray-900 break-words">
            {law.title}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {law.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-4 text-gray-600">
          <span className="font-medium">{law.document_number}</span>
          {formattedDate && <span>Publicerad: {formattedDate}</span>}
        </div>
      </header>

      {/* Law content */}
      <article className="prose prose-gray max-w-none">
        {law.full_text ? (
          <div className="whitespace-pre-wrap">{law.full_text}</div>
        ) : (
          <p className="text-gray-500 italic">
            Ingen lagtext tillgänglig. Besök{' '}
            <a
              href={law.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Riksdagen
            </a>{' '}
            för att läsa originaldokumentet.
          </p>
        )}
      </article>

      {/* Source link */}
      <footer className="mt-8 border-t pt-4">
        <p className="text-sm text-gray-500">
          Källa:{' '}
          <a
            href={law.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Riksdagen
          </a>
        </p>
      </footer>
    </main>
  )
}

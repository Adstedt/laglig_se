import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alla lagar - Svensk författningssamling | Laglig.se',
  description:
    'Utforska alla svenska lagar i Svensk författningssamling (SFS). Sök och läs lagtexter kostnadsfritt.',
  openGraph: {
    title: 'Alla lagar - Svensk författningssamling',
    description:
      'Utforska alla svenska lagar i Svensk författningssamling (SFS). Sök och läs lagtexter kostnadsfritt.',
    type: 'website',
    siteName: 'Laglig.se',
  },
}

export default async function AllaLagarPage() {
  const laws = await prisma.legalDocument.findMany({
    where: {
      content_type: ContentType.SFS_LAW,
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      slug: true,
      publication_date: true,
    },
    orderBy: {
      publication_date: 'desc',
    },
  })

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-600">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-gray-900 hover:underline">
              Hem
            </Link>
          </li>
          <li aria-hidden="true">→</li>
          <li aria-current="page" className="text-gray-900">
            Alla lagar
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Alla lagar</h1>
        <p className="mt-2 text-gray-600">
          {laws.length} lagar i Svensk författningssamling (SFS)
        </p>
      </header>

      {/* Law list */}
      <section aria-label="Lista över lagar">
        <ul className="divide-y divide-gray-200">
          {laws.map((law) => (
            <li key={law.id}>
              <Link
                href={`/alla-lagar/${law.slug}`}
                className="block py-4 hover:bg-gray-50"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium text-gray-900 hover:text-blue-600">
                    {law.title}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{law.document_number}</span>
                    {law.publication_date && (
                      <span>
                        Publicerad:{' '}
                        {new Date(law.publication_date).toLocaleDateString(
                          'sv-SE',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {laws.length === 0 && (
        <p className="py-8 text-center text-gray-500">
          Inga lagar hittades. Kör <code>pnpm ingest-laws</code> för att ladda
          lagar.
        </p>
      )}
    </main>
  )
}

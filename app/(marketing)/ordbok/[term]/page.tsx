import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGlossaryTerm, listGlossarySlugs } from '@/lib/marketing/glossary'
import { getBaseUrl, serializeJsonLd } from '@/lib/marketing/get-page-metadata'
import { GlossaryTermTemplate } from '@/components/marketing/templates/glossary-term-template'

export function generateStaticParams() {
  return listGlossarySlugs().map((term) => ({ term }))
}

export const dynamicParams = false

function metaTitleFor(term: string, override?: string): string {
  return override ?? `${term} — betydelse & förklaring`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>
}): Promise<Metadata> {
  const { term } = await params
  const page = getGlossaryTerm(term)
  if (!page) return {}
  const fm = page.frontmatter
  const baseUrl = getBaseUrl()
  const canonical = `${baseUrl}/ordbok/${term}`
  const title = metaTitleFor(fm.term, fm.metaTitle)
  return {
    title,
    description: fm.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: fm.description,
      url: canonical,
      siteName: 'Laglig.se',
      locale: 'sv_SE',
      type: 'article',
    },
  }
}

export default async function OrdbokTermPage({
  params,
}: {
  params: Promise<{ term: string }>
}) {
  const { term } = await params
  const page = getGlossaryTerm(term)
  if (!page) notFound()

  const { default: Body } = await import(
    `@/content/marketing/ordbok/${term}.mdx`
  )
  const fm = page.frontmatter
  const baseUrl = getBaseUrl()
  const canonical = `${baseUrl}/ordbok/${term}`

  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hem', item: baseUrl },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Ordbok',
          item: `${baseUrl}/ordbok`,
        },
        { '@type': 'ListItem', position: 3, name: fm.term, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: fm.term,
      description: fm.shortDefinition,
      inLanguage: 'sv-SE',
      url: canonical,
      ...(fm.synonyms && fm.synonyms.length > 0
        ? { alternateName: fm.synonyms }
        : {}),
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'Laglig.se ordbok — lagefterlevnad & regelverk',
        url: `${baseUrl}/ordbok`,
      },
    },
  ]

  if (fm.faq.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: fm.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }

  return (
    <>
      {jsonLd.map((payload, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
        />
      ))}
      <GlossaryTermTemplate slug={term} frontmatter={fm}>
        <Body />
      </GlossaryTermTemplate>
    </>
  )
}

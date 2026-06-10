import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getMarketingPage, listMarketingSlugs } from '@/lib/marketing/content'
import {
  generateMarketingMetadata,
  getMarketingJsonLd,
  serializeJsonLd,
} from '@/lib/marketing/get-page-metadata'
import { TopicPageTemplate } from '@/components/marketing/templates/topic-page-template'
import type { TopicPageFrontmatter } from '@/lib/marketing/frontmatter-schemas'

const KIND = 'omraden' as const

export function generateStaticParams() {
  return listMarketingSlugs(KIND).map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getMarketingPage(KIND, slug)
  if (!page) return {}
  return generateMarketingMetadata(KIND, slug, page.frontmatter)
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getMarketingPage(KIND, slug)
  if (!page) notFound()

  const { default: Body } = await import(
    `@/content/marketing/omraden/${slug}.mdx`
  )
  const jsonLd = getMarketingJsonLd(KIND, slug, page.frontmatter)

  return (
    <>
      {jsonLd.map((payload, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
        />
      ))}
      <TopicPageTemplate
        slug={slug}
        frontmatter={page.frontmatter as TopicPageFrontmatter}
      >
        <Body />
      </TopicPageTemplate>
    </>
  )
}

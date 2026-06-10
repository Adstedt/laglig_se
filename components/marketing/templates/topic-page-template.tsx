import { BasePageTemplate } from './base-page-template'
import type { TopicPageFrontmatter } from '@/lib/marketing/frontmatter-schemas'

/** Topic-page layout (/omraden/[slug]) — reference-style, leans on the
 *  catalog list + live change feed (freshness signal). */
export function TopicPageTemplate({
  slug,
  frontmatter,
  children,
}: {
  slug: string
  frontmatter: TopicPageFrontmatter
  children: React.ReactNode
}) {
  return (
    <BasePageTemplate
      kind="omraden"
      slug={slug}
      frontmatter={frontmatter}
      showChangeFeed
    >
      {children}
    </BasePageTemplate>
  )
}

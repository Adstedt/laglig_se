import { BasePageTemplate } from './base-page-template'
import type { FeaturePageFrontmatter } from '@/lib/marketing/frontmatter-schemas'

/** Feature-page layout (/funktioner/[slug]) — product-depth storytelling. */
export function FeaturePageTemplate({
  slug,
  frontmatter,
  children,
}: {
  slug: string
  frontmatter: FeaturePageFrontmatter
  children: React.ReactNode
}) {
  return (
    <BasePageTemplate kind="funktioner" slug={slug} frontmatter={frontmatter}>
      {children}
    </BasePageTemplate>
  )
}

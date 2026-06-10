import { BasePageTemplate } from './base-page-template'
import type { IndustryPageFrontmatter } from '@/lib/marketing/frontmatter-schemas'

/** Industry-page layout (/branscher/[slug]) — buyer-mental-model match. */
export function IndustryPageTemplate({
  slug,
  frontmatter,
  children,
}: {
  slug: string
  frontmatter: IndustryPageFrontmatter
  children: React.ReactNode
}) {
  return (
    <BasePageTemplate kind="branscher" slug={slug} frontmatter={frontmatter}>
      {children}
    </BasePageTemplate>
  )
}

// Server-only by construction: node:fs imports make this module unusable in
// client bundles (and there is no 'server-only' package in this repo).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import {
  MARKETING_KINDS,
  frontmatterSchemaByKind,
  type MarketingFrontmatter,
  type MarketingKind,
} from './frontmatter-schemas'

/**
 * Server-only loader for the marketing content surface.
 *
 * Frontmatter is parsed with gray-matter and validated against the kind's
 * Zod schema. The MDX *body* is NOT compiled here — routes dynamically
 * import the .mdx module (compiled by @next/mdx; remark-frontmatter strips
 * the YAML block from the rendered output). This loader exists so
 * generateStaticParams / generateMetadata / the sitemap walker share one
 * validated view of the content folder.
 *
 * Because routes call this inside generateStaticParams-driven SSG, a
 * validation throw here fails `next build` — that's the build-time
 * enforcement Story 26.1 AC 4 requires.
 */

const CONTENT_ROOT = join(process.cwd(), 'content', 'marketing')

export interface MarketingPageMeta {
  kind: MarketingKind
  slug: string
  frontmatter: MarketingFrontmatter
  /** filesystem path — used by the sitemap walker for lastmod */
  filePath: string
}

/** Underscore-prefixed files (_template.mdx, drafts) never publish. */
function isPublishedSlug(fileName: string): boolean {
  return fileName.endsWith('.mdx') && !fileName.startsWith('_')
}

export function listMarketingSlugs(kind: MarketingKind): string[] {
  const dir = join(CONTENT_ROOT, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(isPublishedSlug)
    .map((f) => f.replace(/\.mdx$/, ''))
    .sort()
}

export function getMarketingPage(
  kind: MarketingKind,
  slug: string
): MarketingPageMeta | null {
  // Defense-in-depth: never serve underscore drafts or path-traversal slugs.
  if (slug.startsWith('_') || !/^[a-z0-9-]+$/.test(slug)) return null

  const filePath = join(CONTENT_ROOT, kind, `${slug}.mdx`)
  if (!existsSync(filePath)) return null

  const raw = readFileSync(filePath, 'utf-8')
  const { data } = matter(raw)

  const result = frontmatterSchemaByKind[kind].safeParse({ ...data, kind })
  if (!result.success) {
    const fields = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    // Thrown during SSG → fails `next build` naming file + fields (AC 4).
    throw new Error(
      `[MARKETING_FRONTMATTER_INVALID] content/marketing/${kind}/${slug}.mdx — ${fields}`
    )
  }

  return {
    kind,
    slug,
    frontmatter: result.data as MarketingFrontmatter,
    filePath,
  }
}

/** Validated metadata for every published page of a kind. Used by the
 *  sitemap walker and RelatedPagesGrid lookups. */
export function listMarketingPages(kind: MarketingKind): MarketingPageMeta[] {
  return listMarketingSlugs(kind)
    .map((slug) => getMarketingPage(kind, slug))
    .filter((p): p is MarketingPageMeta => p !== null)
}

/**
 * Flat list of published marketing routes (Story 26.2) — computed server-side
 * and passed into NavbarV3/FooterV3 as a serializable prop so menu items flip
 * from "Kommer snart" to live links automatically as content ships.
 */
export function getPublishedMarketingRoutes(): string[] {
  return MARKETING_KINDS.flatMap((kind) =>
    listMarketingSlugs(kind).map((slug) => `/${kind}/${slug}`)
  )
}

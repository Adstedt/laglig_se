// Server-only by construction: node:fs imports make this module unusable in
// client bundles (there is no 'server-only' package in this repo).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
import {
  catalogLawEntrySchema,
  faqItemSchema,
  type CatalogLawEntry,
  type FaqItem,
} from './frontmatter-schemas'

/**
 * Ordbok / glossary substrate (Story 26.11).
 *
 * A SEPARATE surface from the three MARKETING_KINDS (funktioner/branscher/
 * omraden). Those share `baseFrontmatter` — a full org-check hero, min-3 FAQ
 * and ~1100-word bodies. A glossary term is 200–500 words, definition-first,
 * built for featured-snippet + DefinedTerm capture, so it gets its own light
 * schema, loader and template rather than a bloated fourth kind.
 *
 * One file per term: content/marketing/ordbok/[term].mdx. Frontmatter carries
 * the metadata + the snippet-ready short definition; the MDX body holds the
 * longer explanation (may use DefinitionBox, ProcessSteps, tables).
 */

const ORDBOK_ROOT = join(process.cwd(), 'content', 'marketing', 'ordbok')

/** Grouping used on the /ordbok index and the eyebrow. Kept as a free string
 *  (not an enum) so editorial can add groups without a code change; the index
 *  orders known groups first, then any others alphabetically. */
export const glossaryTermSchema = z.object({
  /** The defined term exactly as written, e.g. "Laglista". H1 + DefinedTerm name. */
  term: z.string().trim().min(1),
  /** Snippet-ready one/two-sentence answer, rendered immediately under the H1
   *  (answer-first) and used as the DefinedTerm description. */
  shortDefinition: z.string().trim().min(1).max(320),
  /** Meta description (~155; schema hard-caps 170). */
  description: z.string().trim().min(1).max(170),
  /** Optional SEO <title> override; defaults to "`term` — betydelse & förklaring". */
  metaTitle: z.string().trim().max(70).optional(),
  /** Display group (eyebrow + index grouping), e.g. "Lagefterlevnad". */
  category: z.string().trim().min(1),
  /** Show the org-number tester between the body and the catalog list.
   *  Defaults ON. Pure legal-concept terms (rättskälla, direktiv) can set
   *  false to keep the page a neutral reference rather than a conversion slot. */
  showOrgCheck: z.boolean().optional().default(true),
  /** "Även kallad …" + DefinedTerm alternateName. */
  synonyms: z.array(z.string().trim().min(1)).optional(),
  relatedCatalogLaws: z.array(catalogLawEntrySchema).default([]),
  relatedPages: z.array(z.string().trim().startsWith('/')).default([]),
  /** Optional FAQPage capture (glossary terms often carry "skillnaden mellan X och Y"). */
  faq: z.array(faqItemSchema).default([]),
})

export type GlossaryTermFrontmatter = z.infer<typeof glossaryTermSchema>

export interface GlossaryTermMeta {
  slug: string
  frontmatter: GlossaryTermFrontmatter
  /** filesystem path — used by the sitemap walker for lastmod */
  filePath: string
}

/** Underscore-prefixed files (_template.mdx, drafts) never publish. */
function isPublishedSlug(fileName: string): boolean {
  return fileName.endsWith('.mdx') && !fileName.startsWith('_')
}

export function listGlossarySlugs(): string[] {
  if (!existsSync(ORDBOK_ROOT)) return []
  return readdirSync(ORDBOK_ROOT)
    .filter(isPublishedSlug)
    .map((f) => f.replace(/\.mdx$/, ''))
    .sort()
}

export function getGlossaryTerm(slug: string): GlossaryTermMeta | null {
  // Defense-in-depth: never serve underscore drafts or path-traversal slugs.
  if (slug.startsWith('_') || !/^[a-z0-9-]+$/.test(slug)) return null

  const filePath = join(ORDBOK_ROOT, `${slug}.mdx`)
  if (!existsSync(filePath)) return null

  const raw = readFileSync(filePath, 'utf-8')
  const { data } = matter(raw)

  const result = glossaryTermSchema.safeParse(data)
  if (!result.success) {
    const fields = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    // Thrown during SSG → fails `next build` naming file + fields.
    throw new Error(
      `[ORDBOK_FRONTMATTER_INVALID] content/marketing/ordbok/${slug}.mdx — ${fields}`
    )
  }

  return { slug, frontmatter: result.data, filePath }
}

/** All published terms, validated. Used by the index page and sitemap walker. */
export function listGlossaryTerms(): GlossaryTermMeta[] {
  return listGlossarySlugs()
    .map((slug) => getGlossaryTerm(slug))
    .filter((t): t is GlossaryTermMeta => t !== null)
}

export type { CatalogLawEntry, FaqItem }

import { z } from 'zod'

/**
 * Typed frontmatter schemas for the marketing-page content surface
 * (content/marketing/{kind}/[slug].mdx). One schema per template kind.
 *
 * Validation runs at build time via lib/marketing/content.ts — a missing or
 * invalid required field fails `next build` with the file + field named, so
 * editorial mistakes never reach production. (Story 26.1 AC 3–4)
 */

/** One entry in a page's related-laws list. Resolution to live LegalDocument
 *  rows is Story 26.3; the shape is fixed now so MDX written today survives.
 *  Strings are trimmed (QA-26.3-1): resolution is exact-match against
 *  document_number/slug, so a trailing space in frontmatter would silently
 *  unmatch an otherwise-valid law. */
export const catalogLawEntrySchema = z
  .object({
    documentNumber: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    anchor: z.string().trim().min(1).optional(),
  })
  .refine((e) => e.documentNumber || e.slug, {
    message: 'catalog law entry needs a documentNumber or a slug',
  })

export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})

export const heroMediaSchema = z.object({
  type: z.enum(['screenshot', 'photo']),
  src: z.string().min(1),
  alt: z.string().min(1),
})

export const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
})

/** Fields shared by all three template kinds. `faq` is REQUIRED (min 3
 *  page-specific Q&As) — it renders as <FaqAccordion> AND emits FAQPage
 *  JSON-LD from the same array, so structured data never drifts from
 *  visible content. (Epic 26 v0.4) */
const baseFrontmatter = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(170),
  heroEyebrow: z.string().min(1),
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().min(1),
  primaryCta: ctaSchema,
  showOrgCheck: z.boolean(),
  /** Lead the hero with the org-number tester instead of the plain CTA button
   *  (trial signup demoted to a secondary link). Opt-in per page so the
   *  treatment can roll out gradually; the mid-page tester is independent and
   *  still governed by `showOrgCheck`. */
  heroOrgCheck: z.boolean().optional(),
  relatedCatalogLaws: z.array(catalogLawEntrySchema),
  relatedPages: z.array(z.string().trim().startsWith('/')),
  faq: z.array(faqItemSchema).min(3),
  heroMedia: heroMediaSchema.optional(),
  ogVariant: z.string().optional(),
})

export const featurePageSchema = baseFrontmatter.extend({
  kind: z.literal('funktioner'),
})

export const industryPageSchema = baseFrontmatter.extend({
  kind: z.literal('branscher'),
})

export const topicPageSchema = baseFrontmatter.extend({
  kind: z.literal('omraden'),
})

export const MARKETING_KINDS = ['funktioner', 'branscher', 'omraden'] as const
export type MarketingKind = (typeof MARKETING_KINDS)[number]

/** Display labels for breadcrumbs, JSON-LD and OG images — single source. */
export const MARKETING_KIND_LABELS: Record<MarketingKind, string> = {
  funktioner: 'Funktioner',
  branscher: 'Branscher',
  omraden: 'Områden',
}

export const frontmatterSchemaByKind = {
  funktioner: featurePageSchema,
  branscher: industryPageSchema,
  omraden: topicPageSchema,
} as const satisfies Record<MarketingKind, z.ZodTypeAny>

export type CatalogLawEntry = z.infer<typeof catalogLawEntrySchema>
export type FaqItem = z.infer<typeof faqItemSchema>
export type HeroMedia = z.infer<typeof heroMediaSchema>
export type FeaturePageFrontmatter = z.infer<typeof featurePageSchema>
export type IndustryPageFrontmatter = z.infer<typeof industryPageSchema>
export type TopicPageFrontmatter = z.infer<typeof topicPageSchema>
export type MarketingFrontmatter =
  | FeaturePageFrontmatter
  | IndustryPageFrontmatter
  | TopicPageFrontmatter

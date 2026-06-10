import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export interface RelatedPage {
  href: string
  title: string
  description?: string | undefined
}

/** Card grid of sibling marketing pages — the internal-linking section. */
export function RelatedPagesGrid({
  heading = 'Läs vidare',
  pages,
}: {
  heading?: string | undefined
  pages: RelatedPage[]
}) {
  if (pages.length === 0) return null

  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      <h2 className="mb-8 font-safiro text-2xl font-medium tracking-tight text-foreground">
        {heading}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="flex items-center justify-between gap-2 font-safiro text-base font-medium text-foreground">
              {page.title}
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </h3>
            {page.description && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {page.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

import type { LucideIcon } from 'lucide-react'

export interface FeatureGridItem {
  icon: LucideIcon
  title: string
  description: string
}

/** n-up grid of icon + title + description — the quick-scan capability list. */
export function FeatureGrid({
  heading,
  items,
  columns = 3,
}: {
  heading?: string | undefined
  items: FeatureGridItem[]
  columns?: 2 | 3
}) {
  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      {heading && (
        <h2 className="mb-10 text-center font-safiro text-2xl font-medium tracking-tight text-foreground md:text-3xl">
          {heading}
        </h2>
      )}
      <div
        className={`grid gap-6 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}
      >
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground/70">
              <item.icon className="h-5 w-5" />
            </span>
            <h3 className="font-safiro text-base font-medium text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

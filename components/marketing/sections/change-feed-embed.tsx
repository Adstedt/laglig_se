import { Bell } from 'lucide-react'

export interface ChangeFeedItem {
  title: string
  date: string
  href: string
}

/**
 * Live law-change feed for a topic area — the freshness signal on topic pages.
 *
 * DATA SOURCE NOT BUILT YET: there is no public lagändringar-by-topic API
 * (only per-amendment pages + an internal cron). Story 26.7 ships the
 * endpoint and wires `items`; until then callers omit `items` and this
 * renders the designed empty state. Props are final — don't reshape in 26.7.
 */
export function ChangeFeedEmbed({
  heading = 'Senaste ändringarna',
  items = [],
}: {
  heading?: string | undefined
  items?: ChangeFeedItem[] | undefined
}) {
  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground/70">
            <Bell className="h-4.5 w-4.5" />
          </span>
          <h2 className="font-safiro text-xl font-medium tracking-tight text-foreground md:text-2xl">
            {heading}
          </h2>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Laglig bevakar lagändringar inom området löpande. Skapa ett konto
              så får ni ändringarna direkt i er laglista.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-secondary/50"
                >
                  <span className="font-medium text-foreground">
                    {item.title}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {item.date}
                  </time>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

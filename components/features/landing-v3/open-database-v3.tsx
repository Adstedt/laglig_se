import Link from 'next/link'
import {
  ArrowRight,
  Search,
  BookOpen,
  Globe,
  FileText,
  Gavel,
} from 'lucide-react'

const corpus = [
  {
    href: '/lagar',
    label: 'Svenska lagar',
    sub: 'SFS-databasen',
    icon: BookOpen,
  },
  {
    href: '/foreskrifter',
    label: 'Myndighetsföreskrifter',
    sub: 'AFS · MSBFS · m.fl.',
    icon: FileText,
  },
  {
    href: '/eu',
    label: 'EU-rätt',
    sub: 'Förordningar & direktiv',
    icon: Globe,
  },
  {
    href: '/rattskallor',
    label: 'Rättskällor & domar',
    sub: 'Praxis och vägledning',
    icon: Gavel,
  },
]

export function OpenDatabaseV3() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      {/* Subtle architectural backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(at 15% 25%, hsl(40 30% 95% / 0.6) 0px, transparent 50%),
            radial-gradient(at 85% 75%, hsl(220 30% 96% / 0.5) 0px, transparent 50%)
          `,
        }}
      />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 grid items-end gap-8 lg:grid-cols-2">
            <div>
              <p
                className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Sveriges öppna lagbok
              </p>
              <h2
                className="text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Lagboken ska vara gratis.
                <br />
                Hos oss är den det.
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Alla svenska lagar, föreskrifter och EU-regler – fria att söka i.
              Inget konto, inga begränsningar. Vi tar betalt för hjälpen att
              följa lagen, aldrig för att läsa den.
            </p>
          </div>

          {/* Big search affordance */}
          <Link
            href="/sok"
            className="group mb-8 flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-foreground/40 hover:shadow-md md:p-6"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Search className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Sök i hela lagboken
              </p>
              <p className="truncate text-base font-medium">
                t.ex. &quot;arbetsmiljö&quot;, &quot;GDPR&quot;,
                &quot;semester&quot;, &quot;bokföring&quot;
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>

          {/* Corpus quadrants */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {corpus.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-all hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70 transition-colors group-hover:bg-foreground group-hover:text-background">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-base font-semibold"
                      style={{
                        fontFamily: "'Safiro', system-ui, sans-serif",
                      }}
                    >
                      {item.label}
                    </p>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.sub}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

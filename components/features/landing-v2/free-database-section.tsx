import Link from 'next/link'
import {
  ArrowRight,
  Search,
  BookOpen,
  Globe,
  FileText,
  Gavel,
} from 'lucide-react'

const corpusLinks = [
  {
    href: '/lagar',
    label: 'Svenska lagar',
    description: 'Alla SFS-lagar och förordningar',
    icon: BookOpen,
  },
  {
    href: '/foreskrifter',
    label: 'Myndighetsföreskrifter',
    description: 'AFS, MSBFS, MPRTFS m.fl.',
    icon: FileText,
  },
  {
    href: '/eu',
    label: 'EU-rätt',
    description: 'Förordningar och direktiv',
    icon: Globe,
  },
  {
    href: '/rattskallor',
    label: 'Rättskällor & domar',
    description: 'Rättsfall och praxis',
    icon: Gavel,
  },
]

export function FreeDatabaseSection() {
  return (
    <section className="relative overflow-hidden border-y bg-section-cream py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(at 20% 30%, hsl(35 40% 92% / 0.6) 0px, transparent 50%),
              radial-gradient(at 80% 70%, hsl(40 35% 94% / 0.5) 0px, transparent 50%)
            `,
          }}
        />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: pitch */}
            <div>
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Helt gratis · Inget konto krävs
              </div>
              <h2
                className="font-safiro mb-4 text-3xl font-medium tracking-tight sm:text-4xl"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Slå upp en lag.{' '}
                <span className="text-muted-foreground">Just nu.</span>
              </h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Vi tror på öppen tillgång till lagstiftning. Hela databasen –
                svenska lagar, föreskrifter, EU-rätt och rättskällor – är fri
                att söka i, utan registrering.
              </p>

              <Link
                href="/sok"
                className="group inline-flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Search className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs text-muted-foreground">
                    Sök i hela databasen
                  </span>
                  <span className="text-sm font-medium">
                    t.ex. &quot;arbetsmiljö&quot;, &quot;GDPR&quot;, &quot;AFS
                    2024:1&quot;
                  </span>
                </div>
                <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>

              <p className="mt-6 text-sm text-muted-foreground">
                Med ett konto får ni en personlig laglista, ändringsbevakning
                och AI-assistent ovanpå – men databasen i sig är öppen.
              </p>
            </div>

            {/* Right: corpus shortcuts */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {corpusLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start gap-3 rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold">{link.label}</p>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

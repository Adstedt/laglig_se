import Link from 'next/link'
import { ArrowRight, Search, BookOpen, Globe, FileText } from 'lucide-react'
import { SectionLabel } from './section-label'
import { SearchResultCard } from '@/components/features/search/search-result-card'
import type { SearchResult } from '@/app/actions/search'

const corpus = [
  {
    href: '/lagar',
    label: 'Svenska lagar',
    sub: 'SFS-databasen',
    icon: BookOpen,
  },
  {
    href: '/rattskallor?types=AGENCY_REGULATION',
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
    href: '/sok',
    label: 'Sök i lagboken',
    sub: 'Fritt i hela regelverket',
    icon: Search,
  },
]

// Real results (shaped to SearchResult) so the preview renders the actual
// SearchResultCard — it's the open database, shown rather than described.
const RESULTS: SearchResult[] = [
  {
    id: 'odb-1',
    title: 'Arbetsmiljölag (1977:1160)',
    documentNumber: 'SFS 1977:1160',
    contentType: 'SFS_LAW',
    sfsInstrument: 'LAG',
    category: null,
    summary: null,
    effectiveDate: '1978-07-01',
    status: 'ACTIVE',
    slug: 'sfs-1977-1160',
    snippet:
      'Lagens ändamål är att förebygga ohälsa och olycksfall i <mark>arbetet</mark> samt att uppnå en god arbetsmiljö.',
    rank: 1,
  },
  {
    id: 'odb-2',
    title: 'AFS 2023:1 — Systematiskt arbetsmiljöarbete',
    documentNumber: 'AFS 2023:1',
    contentType: 'AGENCY_REGULATION',
    sfsInstrument: null,
    category: null,
    summary: null,
    effectiveDate: '2025-01-01',
    status: 'ACTIVE',
    slug: 'afs-2023-1',
    snippet:
      'Föreskrifter om hur <mark>arbetsmiljö</mark>arbetet ska bedrivas systematiskt — undersöka, bedöma, åtgärda och följa upp.',
    rank: 2,
  },
  {
    id: 'odb-3',
    title: 'Arbetstidslag (1982:673)',
    documentNumber: 'SFS 1982:673',
    contentType: 'SFS_LAW',
    sfsInstrument: 'LAG',
    category: null,
    summary: null,
    effectiveDate: '1983-01-01',
    status: 'ACTIVE',
    slug: 'sfs-1982-673',
    snippet:
      'Reglerar arbetstid, dygnsvila, veckovila och raster — gäller utöver kraven på <mark>arbetsmiljö</mark>.',
    rank: 3,
  },
]

export function OpenDatabaseV3() {
  return (
    <section className="relative overflow-hidden bg-background py-12 md:py-20">
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <SectionLabel index="05" className="mb-4">
            Öppen lagbok
          </SectionLabel>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* LEFT — editorial */}
            <div className="lg:col-span-5">
              <h2
                className="mb-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-[3rem]"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Lagboken ska vara gratis.
                <br />
                <span className="text-foreground/40">Hos oss är den det.</span>
              </h2>

              <p className="mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
                Alla svenska lagar, föreskrifter och EU-regler — fria att söka
                i. Inget konto, inga begränsningar. Vi tar betalt för hjälpen
                att följa reglerna, aldrig för att läsa dem.
              </p>

              {/* browse by source */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {corpus.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-all hover:border-foreground/30 hover:shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/55 transition-colors group-hover:text-foreground">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.sub}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* RIGHT — the open database, shown (real search results) */}
            <div className="lg:col-span-7">
              {/* search bar */}
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">arbetsmiljö</span>
                <span className="h-4 w-px animate-pulse bg-foreground/60" />
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  1 240 träffar
                </span>
              </div>

              {/* results — the real SearchResultCard */}
              <div className="mt-3 space-y-2.5">
                {RESULTS.map((doc, i) => (
                  <SearchResultCard
                    key={doc.id}
                    document={doc}
                    query="arbetsmiljö"
                    position={i}
                  />
                ))}
              </div>

              <Link
                href="/sok"
                className="mt-3 inline-flex items-center gap-1.5 px-1 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                Öppna hela regelverket — gratis
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

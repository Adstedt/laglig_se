import {
  BookOpen,
  FileCheck,
  ListChecks,
  ClipboardCheck,
  Eye,
  ArrowRight,
} from 'lucide-react'

const stages = [
  {
    n: '01',
    icon: BookOpen,
    title: 'Er laglista',
    desc: 'Er egen lista över lagar som gäller just ert företag. Skapas automatiskt från ert org-nummer.',
  },
  {
    n: '02',
    icon: FileCheck,
    title: 'Krav & bevis',
    desc: 'Varje lag blir konkreta saker att göra. Spara intyg, rutiner och filer som visar att ni gjort dem.',
  },
  {
    n: '03',
    icon: ListChecks,
    title: 'Uppgifter',
    desc: 'Vem gör vad, och när? Fördela uppgifter och följ läget i tavla, lista eller kalender.',
  },
  {
    n: '04',
    icon: ClipboardCheck,
    title: 'Genomgångar',
    desc: 'Stäm av läget med jämna mellanrum. Fånga upp det som missats – innan någon annan gör det.',
  },
  {
    n: '05',
    icon: Eye,
    title: 'Visa revisorn',
    desc: 'När revisorn frågar "hur gör ni?" – visa hela kedjan med ett klick. Bjud in revisorn med läsbehörighet.',
  },
]

export function BreadthSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y bg-section-cream py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2
            className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Allt på ett ställe – från lag till klart.
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Inga spretiga Excel-ark. Inga system som inte pratar med varandra.
            Bara en plats för allt.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          {/* Desktop: horizontal flow */}
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-3">
            {stages.map((stage, i) => (
              <div key={stage.n} className="relative">
                {i < stages.length - 1 && (
                  <div className="absolute right-[-14px] top-12 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
                <div className="flex h-full flex-col rounded-2xl border bg-card p-5 transition-all hover:border-foreground/30 hover:shadow-md">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                      <stage.icon className="h-5 w-5" />
                    </div>
                    <span
                      className="text-xs font-medium tracking-wider text-muted-foreground"
                      style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                    >
                      {stage.n}
                    </span>
                  </div>
                  <h3
                    className="mb-2 text-base font-semibold"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {stage.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile/tablet: vertical stack */}
          <div className="space-y-3 lg:hidden">
            {stages.map((stage) => (
              <div
                key={stage.n}
                className="flex gap-4 rounded-2xl border bg-card p-5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                  <stage.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3
                      className="text-base font-semibold"
                      style={{
                        fontFamily: "'Safiro', system-ui, sans-serif",
                      }}
                    >
                      {stage.title}
                    </h3>
                    <span
                      className="text-xs font-medium text-muted-foreground"
                      style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                    >
                      {stage.n}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

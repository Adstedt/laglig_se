import {
  ArrowRight,
  Eye,
  Check,
  Scale,
  ClipboardCheck,
  FileText,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const points = [
  'Gratis för revisorn — egen inloggning, ni betalar inget',
  'Allt samlat och spårbart — slipp jaga underlag i mejl och pärmar',
  'Inga partneravgifter, inga bindningar',
]

// What the invited auditor sees — read-only access to the full, traceable
// picture (reinforces the page's auditability thread).
const access = [
  {
    icon: Scale,
    title: 'Laglista & efterlevnad',
    sub: '42 krav · status per punkt',
  },
  {
    icon: ClipboardCheck,
    title: 'Kontroller & anmärkningar',
    sub: 'Lagefterlevnadskontroll Q1 2026',
  },
  { icon: FileText, title: 'Bevis & dokument', sub: 'kopplade till rätt krav' },
  { icon: History, title: 'Aktivitet & historik', sub: 'vem, vad och när' },
]

export function ByraerSection() {
  return (
    <section id="byraer" className="scroll-mt-16 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            För revisorer och byråer
          </p>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* LEFT — editorial */}
            <div className="lg:col-span-5">
              <h2
                className="mb-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-[3rem]"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Funkar ihop med
                <br />
                <span className="text-foreground/40">er revisor.</span>
              </h2>

              <p className="mb-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Att följa reglerna är ett lagarbete. Era klienter bjuder in er
                med en egen inloggning — ni ser allt som behövs för att granska,
                men ändrar ingenting.
              </p>

              <ul className="mb-8 space-y-3">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-700">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[14px] leading-relaxed text-foreground/80">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>

              <Button asChild>
                <a href="mailto:contact@laglig.se">
                  Kontakta oss
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* RIGHT — the auditor's read-only view */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border bg-card/50 p-4 shadow-[0_1px_0_0_rgb(0_0_0_/_0.02),0_12px_32px_-16px_rgb(0_0_0_/_0.10)] backdrop-blur-sm md:p-5">
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                  {/* header */}
                  <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-[11px] font-semibold text-background">
                      AR
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Andersson Revision</p>
                      <p className="text-[11px] text-muted-foreground">
                        Inbjuden revisor · Nordviken Hotell &amp; Konferens AB
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-400/30">
                      <Eye className="h-3 w-3" />
                      Läsbehörighet
                    </span>
                  </div>

                  {/* what the auditor can see */}
                  <div className="divide-y divide-border/60">
                    {access.map((a) => (
                      <div
                        key={a.title}
                        className="flex items-center gap-3 px-4 py-3.5"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/55 ring-1 ring-border/60">
                          <a.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium">{a.title}</p>
                          <p className="text-[11.5px] text-muted-foreground">
                            {a.sub}
                          </p>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      </div>
                    ))}
                  </div>

                  {/* footer */}
                  <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3 text-[12px]">
                    <span className="text-muted-foreground">
                      Ser allt — ändrar ingenting.
                    </span>
                    <span className="font-medium text-amber-900">
                      Allt spårbart
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

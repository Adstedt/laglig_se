import Link from 'next/link'
import { Shield, CheckCircle2, ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const isoStandards = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 27001']

const auditFeatures = [
  'Komplett spårbarhet för alla lagkrav',
  'Tidsstämplar på alla uppgifter och ändringar',
  'Visuellt Kanban-flöde för audit-genomgång',
  'Automatisk loggning av ansvarig person',
  'Export av audit-rapport med ett klick',
]

export function ComplianceSection() {
  return (
    <section className="bg-section-sage py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Content */}
            <div>
              <Badge variant="outline" className="mb-4">
                <Shield className="mr-2 h-3 w-3" />
                För ISO-certifierade
              </Badge>
              <h2
                className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Audit-redo på 5 minuter
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Slipp panik inför revisionen. All dokumentation och spårbarhet
                som ISO-standarder kräver finns redan på plats.
              </p>

              {/* ISO badges */}
              <div className="mb-8 flex flex-wrap gap-2">
                {isoStandards.map((standard) => (
                  <span
                    key={standard}
                    className="rounded-full border bg-card px-3 py-1 text-sm font-medium"
                  >
                    {standard}
                  </span>
                ))}
              </div>

              {/* Features list */}
              <ul className="mb-8 space-y-3">
                {auditFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button asChild>
                <Link href="/onboarding">
                  Förbered nästa revision
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Right: Kanban preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 blur-2xl" />
              <div className="relative rounded-2xl border bg-card p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Lagefterlevnad - Q1</h3>
                  <Badge variant="secondary">Kanban</Badge>
                </div>

                {/* Mini Kanban */}
                <div className="grid grid-cols-3 gap-3">
                  {/* To Do */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      Att göra
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                        <p className="font-medium">Brandskyddsrutin</p>
                        <p className="mt-1 text-muted-foreground">AFS 2024:1</p>
                      </div>
                    </div>
                  </div>

                  {/* In Progress */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Pågår
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                        <p className="font-medium">GDPR-utbildning</p>
                        <p className="mt-1 text-muted-foreground">3/5 klara</p>
                      </div>
                    </div>
                  </div>

                  {/* Done */}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      Klart
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                        <p className="font-medium">Kemikalielista</p>
                        <p className="mt-1 text-muted-foreground">2025-01-15</p>
                      </div>
                      <div className="rounded-md border bg-card p-2 text-xs shadow-sm">
                        <p className="font-medium">Arbetsmiljöpolicy</p>
                        <p className="mt-1 text-muted-foreground">2025-01-10</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit hint */}
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Redo för export till revisor
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

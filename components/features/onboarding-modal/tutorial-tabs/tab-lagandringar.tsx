/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "Lagändringar"
 *
 * Ports prototype PANEL 5 (_prototypes/onboarding-tutorial-modal.html:2146-2402).
 * Static change card preview — bell header, Hög påverkan pill, red/green diff,
 * AI-bedömning panel, Bedöm/Ej relevant CTAs.
 */

import {
  ArrowUpRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

export function TabLagandringar() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Proaktivitet
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Vi bevakar — ni bedömer påverkan
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          När en lag i er laglista ändras får ansvarig en avi med diff:en — vad
          togs bort, vad lades till. AI-agenten föreslår en första bedömning av
          påverkan; ni godkänner eller justerar.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: Eye,
              title: 'Realtidsbevakning',
              body: 'Riksdag, regerings­kansli, EU-direktiv — vi har ögon på 170k+ dokument.',
            },
            {
              Icon: Sparkles,
              title: 'AI-bedömning av påverkan',
              body: 'Agenten läser diffen + er verksamhet och föreslår hög / medel / låg påverkan.',
            },
            {
              Icon: CheckCircle2,
              title: 'En signatur räcker',
              body: 'Bedöm direkt eller skicka vidare. Allt loggas för revision.',
            },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3 text-[13px]">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-section-sage">
                <Icon
                  className="h-3 w-3 text-[hsl(var(--tone-success-soft-fg))]"
                  aria-hidden="true"
                />
              </span>
              <span>
                <span className="font-medium">{title}</span>
                <span className="block text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm text-[12.5px] font-medium text-foreground underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Läs mer i hjälpcentret
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* RIGHT: change card */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · /lagandringar
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {/* Header */}
          <div className="flex items-start gap-3 border-b border-border bg-card px-4 py-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--tone-danger-soft-bg))] text-[hsl(var(--tone-danger-soft-fg))]"
            >
              <Bell className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                Miljöbalk (1998:808) — 2 kap. 3 § ändrad
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                Publicerat 14 mars · Träder i kraft 1 jun
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tone-danger-soft-bg))] px-2 py-0.5 text-[10.5px] font-medium text-[hsl(var(--tone-danger-soft-fg))]">
              <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
              Hög påverkan
            </span>
          </div>

          {/* Diff block */}
          <div className="border-b border-border px-4 py-3 text-[12px] leading-relaxed">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Diff
            </div>
            <div className="space-y-0.5 font-mono">
              <div className="rounded-sm bg-[hsl(var(--tone-danger-soft-bg))] px-2 py-0.5 text-[hsl(var(--tone-danger-soft-fg))]">
                − Den som bedriver en verksamhet ska utföra de skyddsåtgärder
                som behövs.
              </div>
              <div className="rounded-sm bg-[hsl(var(--tone-success-soft-bg))] px-2 py-0.5 text-[hsl(var(--tone-success-soft-fg))]">
                + Den som bedriver en verksamhet ska utföra de skyddsåtgärder
                som behövs, samt dokumentera bedömningen av nödvändiga åtgärder.
              </div>
            </div>
          </div>

          {/* AI bedömning panel */}
          <div className="border-b border-border bg-section-warm/60 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Bot className="h-3 w-3" aria-hidden="true" />
              AI-bedömning · 87% säkerhet
            </div>
            <p className="text-[12px] leading-relaxed">
              Förslag: <strong>Hög påverkan</strong> för Almåsa. Det nya
              dokumentationskravet träffar er Egenkontroll-rutin (krav 26:19).
              Tilldela Maria L; deadline 1 maj för uppdaterad rutin + bevis.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:bg-foreground/95"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Bedöm
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Ej relevant
            </button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Ansvarig: Alexander A
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

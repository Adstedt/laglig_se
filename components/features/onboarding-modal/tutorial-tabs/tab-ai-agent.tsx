/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "AI-agenten"
 *
 * Ports prototype PANEL 6 (_prototypes/onboarding-tutorial-modal.html:2403-2717).
 * Chat conversation preview — user bubble, agent reasoning, tool-call card,
 * agent response with §-citation chips, suggested-task action card, input bar.
 *
 * §-citation chip styling adopted from real components/features/ai-chat/citation-pill.tsx
 * (docs/architecture/onboarding-modal/tutorial-tabs-drift.md Tab 6).
 */

import {
  ArrowUp,
  ArrowUpRight,
  Bot,
  Lightbulb,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react'

export function TabAiAgent() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Agent
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Ställ frågor — agenten arbetar med er laglista
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Agenten har full kontext på er bransch, era kravpunkter och alla
          paragrafer i 170 000+ svenska och europeiska dokument. Den citerar
          alltid källan och kan föreslå konkreta åtgärder.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: MessageSquare,
              title: 'Konversation, inte sökning',
              body: '"Vad gäller för avfallshantering hos oss?" — agenten svarar i kontext.',
            },
            {
              Icon: Lightbulb,
              title: 'Resonemang som syns',
              body: 'Klicka för att se hur agenten tänker, vilka källor den slog upp, och varför.',
            },
            {
              Icon: Plus,
              title: 'Föreslår åtgärder',
              body: 'Skapar uppgifter, bokar revisioner, eller drar in bevis — direkt från chatten.',
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

      {/* RIGHT: chat preview */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · AI-agent
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <div className="space-y-3 px-4 py-3">
            {/* User bubble */}
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-foreground px-3 py-2 text-[12.5px] text-background">
                Vad krävs för vår egenkontroll av kemikalier?
              </div>
            </div>

            {/* Agent reasoning block (expanded) */}
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                Resonemang
              </div>
              <ul className="space-y-0.5 list-disc pl-4">
                <li>Slå upp 2 kap. 3 § Miljöbalken (försiktighetsprincipen)</li>
                <li>Slå upp 26 kap. 19 § Miljöbalken (egenkontroll)</li>
                <li>Kontrollera om Förordning 2008:245 är i er laglista</li>
              </ul>
            </div>

            {/* Tool-call card */}
            <div className="rounded-md border border-border bg-card px-3 py-2 text-[11.5px]">
              <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Wrench className="h-2.5 w-2.5" aria-hidden="true" />
                Verktyg · searchLaws
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Search className="h-2.5 w-2.5" aria-hidden="true" />
                <span className="font-mono text-[10.5px]">
                  {'q: "egenkontroll kemikalier", limit: 5'}
                </span>
              </div>
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                → 3 träffar i er laglista (Miljöbalk, Förordning 2008:245, AFS
                2014:43)
              </div>
            </div>

            {/* Agent response with citation chips */}
            <div className="flex justify-start">
              <div className="max-w-[88%] space-y-2 rounded-2xl rounded-tl-sm bg-muted/40 px-3 py-2 text-[12.5px]">
                <p>
                  Tre krav landar på er: dokumentera bedömning av nödvändiga
                  skyddsåtgärder <CitationChip label="§ 2:3 MB" />, rutin för
                  fortlöpande kontroll <CitationChip label="§ 26:19 MB" />, och
                  uppgift till tillsynsmyndighet vid förändring{' '}
                  <CitationChip label="§ 11 Förordn. 2008:245" />.
                </p>
                <p>
                  Tre av er kravpunkter under Miljöbalken är redan markerade som
                  &laquo;Saknar bevis&raquo; — vill ni att jag skapar uppgifter
                  för att samla in dem?
                </p>
              </div>
            </div>

            {/* Suggested-task action card */}
            <div className="rounded-md border border-foreground/20 bg-section-warm/60 px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground">
                <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                Föreslagen åtgärd
              </div>
              <div className="mb-2 text-[12px]">
                Skapa 3 uppgifter — en per saknat bevis. Föreslagen ansvarig:
                Maria L. Deadline: 30 apr.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:bg-foreground/95"
                >
                  <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                  Skapa uppgifter
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Inte nu
                </button>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
              <span className="flex-1 text-[12px] text-muted-foreground">
                Fråga agenten…
              </span>
              <button
                type="button"
                aria-label="Skicka"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background"
              >
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CitationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[hsl(var(--tone-info-soft-bg))] px-1.5 py-0 align-baseline text-[10.5px] font-semibold text-[hsl(var(--tone-info-soft-fg))]">
      {label}
    </span>
  )
}

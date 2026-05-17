/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "Kontroller"
 *
 * Ports prototype PANEL 4 (_prototypes/onboarding-tutorial-modal.html:1848-2145).
 * Cycle detail preview with progress + sub-tabs + signed/unsigned items.
 */

import {
  ArrowUpRight,
  CalendarClock,
  CircleCheckBig,
  Check,
  FileSignature,
  GitBranch,
  Repeat,
} from 'lucide-react'

export function TabKontroller() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Rytm
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Återkommande lagefterlevnadskontroll
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Hela laglistan revideras enligt schemat — kvartal, halvår eller år.
          Lead-auditor tilldelar krav till rätt personer; var och en signerar
          sitt avsnitt. Resultatet samlas i en rapport som kan skickas till
          styrelse eller revisor.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: Repeat,
              title: 'Fördefinierat schema',
              body: 'Kontroller startar automatiskt i Q1 / Q3 (eller efter ert val).',
            },
            {
              Icon: FileSignature,
              title: 'Per-person signering',
              body: 'Ansvariga bekräftar sin del. Inga "alla godkänner allt"-modeller.',
            },
            {
              Icon: GitBranch,
              title: 'Findings + åtgärder',
              body: 'Avvikelser blir uppgifter, signaturer flyter över till revisionsspåret.',
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

      {/* RIGHT: kontroll cycle mock */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · /laglistor/kontroller/Q2-2026
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {/* Cycle header */}
          <div className="border-b border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-section-sage text-[11px] font-semibold text-[hsl(var(--tone-success-soft-fg))]"
              >
                AA
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-safiro text-[14px]">
                  Kvartalskontroll Q2-2026
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-2.5 w-2.5" aria-hidden="true" />
                  Lead-auditor · Alexander A · deadline 30 jun
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <CircleCheckBig className="h-3 w-3" aria-hidden="true" />
                12 / 24 signerade
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 rounded-full bg-foreground/80" />
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-0.5 border-b border-border px-2">
            {['Items', 'Findings', 'Rapport'].map((tab, i) => (
              <button
                key={tab}
                type="button"
                className={`relative px-3 py-2 text-[12px] ${
                  i === 0
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {tab}
                {i === 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-foreground"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Items list */}
          <ul className="divide-y divide-border">
            <ItemRow
              title="Miljöbalk — Egenkontroll (26 kap. 19 §)"
              assignee="Maria L"
              signed
            />
            <ItemRow
              title="Avfallsförordning — sortering"
              assignee="Erik H"
              signed
            />
            <ItemRow
              title="Kemiproduktförordning — riskbedömning"
              assignee="Alexander A"
              signed
            />
            <ItemRow
              title="AFS 2020:1 — Arbetsplatsens utformning"
              assignee="Erik H"
            />
          </ul>
        </div>
      </div>
    </div>
  )
}

function ItemRow({
  title,
  assignee,
  signed = false,
}: {
  title: string
  assignee: string
  signed?: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
      <span
        aria-hidden="true"
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          signed
            ? 'bg-[hsl(var(--tone-success-soft-bg))] text-[hsl(var(--tone-success-soft-fg))]'
            : 'border border-border bg-background'
        }`}
      >
        {signed && <Check className="h-2.5 w-2.5" />}
      </span>
      <div className="min-w-0 flex-1 truncate font-medium">{title}</div>
      <span className="text-[11px] text-muted-foreground">{assignee}</span>
      {!signed && (
        <button
          type="button"
          className="rounded-md border border-border bg-background px-2 py-0.5 text-[10.5px] text-foreground hover:bg-accent"
        >
          Signera
        </button>
      )}
    </li>
  )
}

/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "Vad är en laglista?"
 *
 * Ports prototype PANEL 1 (_prototypes/onboarding-tutorial-modal.html:919-1208).
 * Static JSX preview of the /laglistor surface. No real data, no real
 * components, no telemetry — parent <TutorialStep> handles tab_viewed.
 *
 * See docs/architecture/onboarding-modal/tutorial-tabs-drift.md for the per-tab
 * grounding decisions.
 */

import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheckBig,
  CircleDot,
  Filter,
  Layers,
  Search,
  TriangleAlert,
  UserRoundCog,
} from 'lucide-react'

export function TabLaglista() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy column */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Översikt
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Den lagstiftning som faktiskt rör er
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Listan innehåller bara de lagar och föreskrifter som gäller er
          verksamhet. Vi håller den uppdaterad automatiskt — när en paragraf
          ändras får ni en avi och kan göra en bedömning av påverkan.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: Layers,
              title: 'Grupperas i områden',
              body: 'Miljö, arbetsmiljö, kemikalier, brand och fler — alltid samma struktur, oavsett bransch.',
            },
            {
              Icon: UserRoundCog,
              title: 'Lagansvarig per rad',
              body: 'Tilldela ansvar till rätt person — alla blir notifierade om ändringar i sina lagar.',
            },
            {
              Icon: CircleCheckBig,
              title: 'Statusbedömning per rad',
              body: 'Efterlevs / avviker / ej relevant — utgångspunkt för revisioner.',
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

      {/* RIGHT: laglistor table mock */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · /laglistor
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
            <div className="flex w-44 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-muted-foreground">
              <Search className="h-3 w-3" aria-hidden="true" />
              Sök i laglistan…
            </div>
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--tone-info-soft-bg))] px-2 py-0.5 text-[10.5px] font-medium text-[hsl(var(--tone-info-soft-fg))]">
              128 lagar
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              6 områden
            </span>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-muted-foreground"
            >
              <Filter className="h-3 w-3" aria-hidden="true" />
              Filter
            </button>
          </div>

          {/* Group header */}
          <div className="flex items-center gap-2 border-b border-border bg-section-warm/60 px-3 py-2">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-safiro text-[13px]">Miljö</span>
            <span className="text-[11.5px] text-muted-foreground">
              · 12 lagar · 4 avvikelser
            </span>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border">
            <Row
              title="Miljöbalk (1998:808)"
              meta="4 kravpunkter · senast granskad 2 mars"
              initials="AA"
              status="success"
              statusLabel="Efterlevs"
              StatusIcon={Check}
            />
            <Row
              title="Avfallsförordning (2020:614)"
              meta="3 kravpunkter · saknar bevis på 1"
              initials="ML"
              status="warning"
              statusLabel="Saknar bevis"
              StatusIcon={TriangleAlert}
            />
            <Row
              title="Förordning (2008:245) om kemiska produkter"
              meta="7 kravpunkter · senast granskad 18 feb"
              initials="+"
              status="neutral"
              statusLabel="Ej granskad"
              initialsMuted
            />
            <Row
              title="AFS 2020:1 — Arbetsplatsens utformning"
              meta="7 kravpunkter · pågående uppgift"
              initials="EH"
              status="info"
              statusLabel="Pågår"
              StatusIcon={CircleDot}
            />
          </ul>

          <div className="border-t border-border bg-card px-3 py-2 text-[11.5px] text-muted-foreground">
            + 124 till — sortera, filtrera och tilldela när vi är klara
          </div>
        </div>
      </div>
    </div>
  )
}

type ToneStatus = 'success' | 'warning' | 'info' | 'neutral'

const TONE_CLASS: Record<ToneStatus, string> = {
  success:
    'bg-[hsl(var(--tone-success-soft-bg))] text-[hsl(var(--tone-success-soft-fg))]',
  warning:
    'bg-[hsl(var(--tone-warning-soft-bg))] text-[hsl(var(--tone-warning-soft-fg))]',
  info: 'bg-[hsl(var(--tone-info-soft-bg))] text-[hsl(var(--tone-info-soft-fg))]',
  neutral: 'bg-muted text-muted-foreground',
}

function Row({
  title,
  meta,
  initials,
  status,
  statusLabel,
  StatusIcon,
  initialsMuted = false,
}: {
  title: string
  meta: string
  initials: string
  status: ToneStatus
  statusLabel: string
  StatusIcon?: typeof Check
  initialsMuted?: boolean
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{title}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">
          {meta}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
            initialsMuted
              ? 'bg-muted text-muted-foreground'
              : 'bg-section-sage text-[hsl(var(--tone-success-soft-fg))]'
          }`}
        >
          {initials}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${TONE_CLASS[status]}`}
        >
          {StatusIcon && (
            <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
      </div>
    </li>
  )
}

/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "Kravpunkter & bevis"
 *
 * Ports prototype PANEL 2 (_prototypes/onboarding-tutorial-modal.html:1209-1511).
 * Static checklist preview — 3 requirements, file chips for uploaded bevis,
 * Saknar-bevis warning row.
 */

import {
  ArrowUpRight,
  Check,
  CircleCheck,
  FileText,
  ListChecks,
  Paperclip,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

export function TabKravpunkter() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Bevisföring
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Vad lagen kräver — bit för bit
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Varje lag bryts ned i konkreta kravpunkter. Ladda upp policys, rutiner
          och loggar som bevis — eller bocka av att kravet inte gäller er. Inga
          PDF:er att läsa igenom; bara det ni faktiskt behöver göra.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: ListChecks,
              title: 'AI bryter ned paragrafer',
              body: 'Långa lagtexter blir till en lista över faktiska krav — på svenska, utan jurist-jargong.',
            },
            {
              Icon: Paperclip,
              title: 'Bevis kopplas direkt',
              body: 'Dra in en fil från Drive eller välj ur era styrdokument. Vi länkar den till rätt krav.',
            },
            {
              Icon: Sparkles,
              title: 'AI-bedömning per krav',
              body: 'Agenten läser era bevis och föreslår om kravet är uppfyllt, behöver mer underlag, eller inte gäller er.',
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

      {/* RIGHT: kravpunkter checklist */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · Miljöbalk → kravpunkter
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <div className="border-b border-border bg-card px-4 py-3">
            <div className="font-safiro text-[13.5px]">
              Miljöbalk (1998:808)
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              4 kravpunkter · 2 av 4 har bevis
            </div>
          </div>

          <ul className="divide-y divide-border">
            <KravRow
              statusIcon="check"
              title="Verksamhetsutövares ansvar (2 kap. 1 §)"
              body="Ansvar att förebygga skador på människors hälsa och miljön."
              bevis={['Miljöpolicy 2026.pdf']}
              toggle="krav"
            />
            <KravRow
              statusIcon="check"
              title="Försiktighetsprincipen (2 kap. 3 §)"
              body="Skyddsåtgärder ska vidtas när det finns skäl att tro att verksamheten kan medföra skada."
              bevis={['Riskbedömning Q4.pdf', '+2']}
              toggle="krav"
            />
            <KravRow
              statusIcon="warning"
              title="Egenkontroll (26 kap. 19 §)"
              body="Verksamhetsutövare ska fortlöpande planera och kontrollera verksamheten."
              bevisWarning="Saknar bevis — be ansvarig ladda upp egenkontroll-rutin"
              toggle="krav"
            />
            <KravRow
              statusIcon="skip"
              title="Tillståndsplikt (9 kap.)"
              body="Krav på tillstånd för miljöfarlig verksamhet."
              bevisInfo="Markerad som ej tillämplig — Almåsa Havshotell omfattas inte"
              toggle="skip"
            />
          </ul>
        </div>
      </div>
    </div>
  )
}

function KravRow({
  statusIcon,
  title,
  body,
  bevis,
  bevisWarning,
  bevisInfo,
  toggle,
}: {
  statusIcon: 'check' | 'warning' | 'skip'
  title: string
  body: string
  bevis?: string[]
  bevisWarning?: string
  bevisInfo?: string
  toggle: 'krav' | 'skip'
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            statusIcon === 'check'
              ? 'bg-[hsl(var(--tone-success-soft-bg))] text-[hsl(var(--tone-success-soft-fg))]'
              : statusIcon === 'warning'
                ? 'bg-[hsl(var(--tone-warning-soft-bg))] text-[hsl(var(--tone-warning-soft-fg))]'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {statusIcon === 'check' && <Check className="h-3 w-3" />}
          {statusIcon === 'warning' && <TriangleAlert className="h-3 w-3" />}
          {statusIcon === 'skip' && <CircleCheck className="h-3 w-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{title}</div>
          <div className="mb-2 text-[11.5px] leading-snug text-muted-foreground">
            {body}
          </div>

          {bevis && (
            <div className="flex flex-wrap items-center gap-1.5">
              {bevis.map((file) =>
                file.startsWith('+') ? (
                  <span
                    key={file}
                    className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground"
                  >
                    {file}
                  </span>
                ) : (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] text-foreground"
                  >
                    <FileText
                      className="h-2.5 w-2.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {file}
                  </span>
                )
              )}
            </div>
          )}

          {bevisWarning && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--tone-warning-soft-bg))] px-2 py-0.5 text-[10.5px] text-[hsl(var(--tone-warning-soft-fg))]">
              <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
              {bevisWarning}
            </div>
          )}

          {bevisInfo && (
            <div className="text-[10.5px] text-muted-foreground">
              {bevisInfo}
            </div>
          )}
        </div>

        <div className="shrink-0 pt-0.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              toggle === 'krav'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {toggle === 'krav' ? 'Kräver bevis' : 'Ej tillämpligt'}
          </span>
        </div>
      </div>
    </li>
  )
}

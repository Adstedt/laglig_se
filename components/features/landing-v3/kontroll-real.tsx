'use client'

/**
 * Lagefterlevnadskontroll showcase body — a cycle-detail view with summary
 * stats and a findings/avvikelse list. Bespoke + static (the real cycle-detail
 * page is a multi-tab surface with live data, contexts and PDF generation);
 * this mirrors its visual grammar so the showcase reads as the real audit.
 */
import {
  ChevronRight,
  ClipboardCheck,
  FileBadge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react'

// Traceability log — every move in the workspace is recorded over time.
const ACTIVITY: { who: string; what: string; when: string }[] = [
  {
    who: 'Anna Lindqvist',
    what: 'markerade kravet "Serveringstillstånd" som uppfyllt',
    when: '31 mar 2026, 14:12',
  },
  {
    who: 'Erik Holm',
    what: 'kopplade bevis "Riskbedömning kök & servering" till ett krav',
    when: '28 mar 2026, 09:41',
  },
  {
    who: 'Anna Lindqvist',
    what: 'registrerade avvikelse: utbildningsregister saknas',
    when: '24 mar 2026, 16:03',
  },
  {
    who: 'Sofia Karlsson',
    what: 'sparade bedömning för Arbetsmiljölagen',
    when: '20 mar 2026, 11:27',
  },
]

function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

const STATS = [
  { label: 'Granskade krav', value: '20', tone: 'text-foreground' },
  { label: 'Uppfyllda', value: '16', tone: 'text-emerald-600' },
  { label: 'Avvikelser', value: '3', tone: 'text-rose-600' },
  { label: 'Öppna åtgärder', value: '2', tone: 'text-amber-600' },
]

type Severity = 'Hög' | 'Medel' | 'Låg'
type FindingStatus = 'Öppen' | 'Pågår' | 'Åtgärdad'

const FINDINGS: {
  title: string
  source: string
  severity: Severity
  status: FindingStatus
  owner: string
}[] = [
  {
    title: 'Register över utbildad serveringspersonal saknas',
    source: 'Alkohollag (2010:1622) · 8 kap. 12 a §',
    severity: 'Hög',
    status: 'Öppen',
    owner: 'Anna Lindqvist',
  },
  {
    title: 'Årlig riskbedömning för kök & servering ej slutförd',
    source: 'AFS 2023:1 · Systematiskt arbetsmiljöarbete',
    severity: 'Medel',
    status: 'Pågår',
    owner: 'Erik Holm',
  },
  {
    title: 'Brandskyddsrond genomförd efter utsatt datum',
    source: 'Lag (2003:778) om skydd mot olyckor',
    severity: 'Låg',
    status: 'Åtgärdad',
    owner: 'Johan Berg',
  },
]

const SEVERITY_TONE: Record<Severity, string> = {
  Hög: 'bg-rose-500/10 text-rose-700 ring-rose-500/30',
  Medel: 'bg-amber-400/15 text-amber-700 ring-amber-400/40',
  Låg: 'bg-foreground/[0.06] text-foreground/70 ring-border',
}

const STATUS_ICON: Record<FindingStatus, typeof AlertTriangle> = {
  Öppen: AlertTriangle,
  Pågår: Clock,
  Åtgärdad: CheckCircle2,
}
const STATUS_TONE: Record<FindingStatus, string> = {
  Öppen: 'text-rose-600',
  Pågår: 'text-amber-600',
  Åtgärdad: 'text-emerald-600',
}

export function KontrollReal() {
  return (
    <div className="pointer-events-none select-none space-y-6 bg-background px-10 py-9 text-left">
      {/* breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground/80">Kontroller</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Lagefterlevnadskontroll Q1 2026</span>
      </div>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3
              className="text-2xl font-medium tracking-tight"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              Lagefterlevnadskontroll Q1 2026
            </h3>
            <span className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30">
              Avslutad
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Intern revision · Anna Lindqvist · 15 jan–31 mar 2026 · Nordviken –
            hela verksamheten
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80">
          <FileBadge className="h-3.5 w-3.5" />
          Visa rapport
        </span>
      </div>

      {/* progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>18 av 20 krav granskade</span>
          <span>90%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[90%] rounded-full bg-foreground" />
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/70 bg-card p-4"
          >
            <div className={`text-2xl font-semibold ${s.tone}`}>{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* findings */}
      <div className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm font-medium">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          Avvikelser & iakttagelser
        </div>
        <div className="divide-y divide-border/60">
          {FINDINGS.map((f) => {
            const StatusIcon = STATUS_ICON[f.status]
            return (
              <div key={f.title} className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${SEVERITY_TONE[f.severity]}`}
                >
                  {f.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{f.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {f.source} · Ansvarig: {f.owner}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${STATUS_TONE[f.status]}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {f.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* activity log — proves full traceability over time */}
      <div className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" />
          Aktivitet & historik
        </div>
        <div className="divide-y divide-border/60">
          {ACTIVITY.map((a) => (
            <div key={a.what} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground/70 ring-1 ring-border/60">
                {initials(a.who)}
              </span>
              <p className="min-w-0 flex-1 text-sm text-foreground/90">
                <span className="font-medium">{a.who}</span> {a.what}
              </p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {a.when}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

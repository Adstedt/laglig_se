'use client'

import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Search,
  SlidersHorizontal,
  Scale,
  ClipboardCheck,
  Sparkles,
  ListChecks,
  FileText,
  Download,
  ArrowUp,
  CheckCircle2,
  AlertTriangle,
  Link2,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import { cn } from '@/lib/utils'
import { GroupedComplianceTable } from '@/components/features/document-list/grouped-compliance-table'
import {
  MEMBERS,
  GROUPS,
  ITEMS,
  TOTAL,
  EXPANDED_GROUPS,
} from './hero-shot-data'

/* ------------------------------------------------------------------ shared */

function Avatar({ src, className }: { src: string; className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className={cn(
        'h-7 w-7 rounded-full object-cover ring-1 ring-border',
        className
      )}
    />
  )
}

function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      {trail.map((t, i) => (
        <span key={t} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          <span className={i === 0 ? 'font-medium text-foreground/80' : ''}>
            {t}
          </span>
        </span>
      ))}
    </div>
  )
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
      {children}
    </div>
  )
}
function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80">
      {children}
    </div>
  )
}

/* ----------------------------------------------------------- Laglistor view
 * Renders the REAL GroupedComplianceTable fed hardcoded data (no backend). */

const noopAsync = async () => true
const noop = () => {}

export function LaglistorView() {
  return (
    <>
      <Breadcrumb trail={['Nordviken Hotell & Konferens AB', 'Laglistor']} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">Laglistor</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Hantera dina listor och håll koll på relevanta rättsliga krav.
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <GhostBtn>
            <ClipboardCheck className="h-3.5 w-3.5" />
            Skapa kontroll
          </GhostBtn>
          <PrimaryBtn>
            <Plus className="h-3.5 w-3.5" />
            Lägg till dokument
          </PrimaryBtn>
        </div>
      </div>

      {/* Toolbar (page chrome — not part of the table component) */}
      <div className="mt-4 flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-medium">
          <BookOpen className="h-3.5 w-3.5" />
          Laglistor
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-foreground/80 sm:flex">
          <Folder className="h-3.5 w-3.5" />
          Er laglista <span className="text-muted-foreground">(67)</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
        <div className="hidden flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground lg:flex">
          <Search className="h-3.5 w-3.5" />
          Sök dokument…
        </div>
        <div className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-foreground/80 md:flex">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-medium text-foreground/80">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Efterlevnad
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-4">
        <GroupedComplianceTable
          items={ITEMS}
          groups={GROUPS}
          expandedGroups={EXPANDED_GROUPS}
          total={TOTAL}
          hasMore={false}
          isLoading={false}
          onLoadMore={noop}
          onRemoveItem={noopAsync}
          onReorderItems={noopAsync}
          onUpdateItem={noopAsync}
          onBulkUpdate={noopAsync}
          onMoveToGroup={noopAsync}
          onToggleGroup={noop}
          onExpandAll={noop}
          onCollapseAll={noop}
          workspaceMembers={MEMBERS}
          complianceReadOnly
        />
      </div>
    </>
  )
}

/* ----------------------------------------------------------- Assistent view */

export function AssistentView() {
  return (
    <>
      <Breadcrumb trail={['Nordviken Hotell & Konferens AB', 'Assistent']} />
      <div className="mx-auto mt-4 max-w-2xl space-y-4">
        {/* User question */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            Vad krävs för vårt serveringstillstånd enligt alkohollagen?
          </div>
        </div>

        {/* AI answer */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Tänkte igenom era kravpunkter och Alkohollagen · 2 s</span>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
            <p>
              För ert serveringstillstånd ställer Alkohollagen krav på bland
              annat lämplighet, kunskap och fungerande rutiner. De viktigaste
              punkterna för Nordviken:
            </p>
            <ul className="space-y-1.5 pl-1">
              {[
                'Dokumenterade rutiner för ansvarsfull alkoholservering',
                'Personal utbildad i ålderskontroll och servering',
                'Kassaregister och bokföring enligt kraven',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              Källa:
              <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70">
                <BookOpen className="h-3 w-3" />
                Alkohollag (2010:1622) 8 kap.
              </span>
            </p>
          </div>

          {/* Agent action card */}
          <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Förslag på åtgärd
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/70 ring-1 ring-border/60">
                <ListChecks className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  Skapa uppgift: Utbilda serveringspersonal i ansvarsfull
                  alkoholservering
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Föreslagen ansvarig:</span>
                  <Avatar src="/demo-team/anna.webp" className="h-5 w-5" />
                  Anna Lindqvist
                  <span className="text-muted-foreground/50">·</span>
                  <Badge tone="danger" variant="soft">
                    Hög
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <div className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/70">
                Avvisa
              </div>
              <PrimaryBtn>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Godkänn
              </PrimaryBtn>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Fråga om regler och efterlevnad…
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ArrowUp className="h-4 w-4" />
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ Kontroll view */

const FINDINGS = [
  {
    id: 'AVV-01',
    type: 'AVVIKELSE',
    text: 'Brandskyddsrutin saknar dokumenterad utrymningsövning för 2025.',
    owner: '/demo-team/erik.webp',
  },
  {
    id: 'OBS-02',
    type: 'OBSERVATION',
    text: 'Allergiinformation bör uppdateras på menyer i konferensdelen.',
    owner: '/demo-team/johan.webp',
  },
] as const

export function KontrollView() {
  const cs = getStatusBadgeProps('cycle-status', 'AVSLUTAD')
  return (
    <>
      <Breadcrumb
        trail={[
          'Nordviken Hotell & Konferens AB',
          'Kontroller',
          'Lagefterlevnadskontroll Q1 2026',
        ]}
      />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-2xl font-semibold tracking-tight">
              Lagefterlevnadskontroll Q1 2026
            </h3>
            <Badge tone={cs.tone} variant={cs.variant}>
              {cs.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ledande revisor: Anna Lindqvist · 18/18 signerade · Avslutad
            2026-03-28
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <PrimaryBtn>
            <Download className="h-3.5 w-3.5" />
            Ladda ner rapport
          </PrimaryBtn>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Granskade krav', value: '18', tone: 'text-foreground' },
          {
            label: 'Avvikelser',
            value: '2',
            tone: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Observationer',
            value: '3',
            tone: 'text-amber-600 dark:text-amber-400',
          },
          { label: 'Åtgärder skapade', value: '5', tone: 'text-foreground' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border/70 bg-card p-3"
          >
            <div className={cn('text-2xl font-semibold tabular-nums', s.tone)}>
              {s.value}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Report card */}
      <div className="mt-4 rounded-xl border border-border/70 bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Revisionsrapport</span>
          <span className="ml-auto text-xs text-muted-foreground">
            PDF · 6 sidor
          </span>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          <p className="text-sm leading-relaxed text-foreground/90">
            Granskningen omfattar Nordvikens efterlevnad inom arbetsmiljö,
            brand, livsmedel och alkohol. Helhetsbedömningen är god —
            verksamheten har ändamålsenliga rutiner på plats, med två avvikelser
            att åtgärda.
          </p>
          <div className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60">
            {FINDINGS.map((f) => {
              const tp = getStatusBadgeProps('finding-type', f.type)
              return (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <AlertTriangle
                    className={cn(
                      'h-4 w-4 shrink-0',
                      f.type === 'AVVIKELSE'
                        ? 'text-rose-500'
                        : 'text-amber-500'
                    )}
                  />
                  <Badge tone={tp.tone} variant={tp.variant}>
                    {tp.label}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                    {f.text}
                  </span>
                  <Avatar src={f.owner} className="h-6 w-6" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

/* -------------------------------------------------------- Styrdokument view */

const DOCS = [
  {
    name: 'Alkoholpolicy',
    status: 'APPROVED',
    version: 'v2.1',
    owner: '/demo-team/anna.webp',
    links: ['Alkohollagen'],
  },
  {
    name: 'HACCP-plan & egenkontroll',
    status: 'APPROVED',
    version: 'v3.0',
    owner: '/demo-team/johan.webp',
    links: ['Livsmedelslagen', 'Livsmedelsförordningen'],
  },
  {
    name: 'Brandskyddsrutin',
    status: 'IN_REVIEW',
    version: 'v1.4',
    owner: '/demo-team/erik.webp',
    links: ['Lag om skydd mot olyckor'],
  },
  {
    name: 'Krishanteringsplan',
    status: 'APPROVED',
    version: 'v1.0',
    owner: '/demo-team/sofia.webp',
    links: ['AFS 2023:2'],
  },
  {
    name: 'Personalhandbok',
    status: 'APPROVED',
    version: 'v4.2',
    owner: '/demo-team/sofia.webp',
    links: ['Arbetsmiljölagen'],
  },
  {
    name: 'Rutin för systematiskt arbetsmiljöarbete',
    status: 'APPROVED',
    version: 'v2.3',
    owner: '/demo-team/erik.webp',
    links: ['AFS 2023:1'],
  },
  {
    name: 'Dataskyddspolicy (GDPR)',
    status: 'APPROVED',
    version: 'v2.0',
    owner: '/demo-team/maria.webp',
    links: ['Dataskyddsförordningen'],
  },
  {
    name: 'Rutin för allergeninformation',
    status: 'IN_REVIEW',
    version: 'v1.1',
    owner: '/demo-team/johan.webp',
    links: ['Livsmedelsförordningen'],
  },
] as const

export function StyrdokumentView() {
  return (
    <>
      <Breadcrumb trail={['Nordviken Hotell & Konferens AB', 'Styrdokument']} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            Styrdokument
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Era policyer och rutiner — kopplade till lagkraven de uppfyller.
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <PrimaryBtn>
            <Plus className="h-3.5 w-3.5" />
            Nytt dokument
          </PrimaryBtn>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/70">
        <div className="grid grid-cols-[minmax(0,1.4fr)_140px_80px_minmax(0,1.3fr)_44px] gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Dokument</span>
          <span>Status</span>
          <span>Version</span>
          <span className="hidden lg:block">Kopplad till</span>
          <span className="text-right">Ägare</span>
        </div>
        {DOCS.map((d, i) => {
          const sp = getStatusBadgeProps('document-status', d.status)
          return (
            <div
              key={d.name}
              className={cn(
                'grid grid-cols-[minmax(0,1.4fr)_140px_80px_minmax(0,1.3fr)_44px] items-center gap-3 px-4 py-3',
                i !== DOCS.length - 1 && 'border-b border-border/50'
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="truncate text-sm font-medium">{d.name}</span>
              </div>
              <div>
                <Badge
                  tone={sp.tone}
                  variant={sp.variant}
                  className="whitespace-nowrap"
                >
                  {sp.label}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {d.version}
              </span>
              <div className="hidden flex-wrap gap-1 lg:flex">
                {d.links.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    <Link2 className="h-3 w-3" />
                    {l}
                  </span>
                ))}
              </div>
              <div className="flex justify-end">
                <Avatar src={d.owner} className="h-6 w-6" />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ----------------------------------------------------------- Regelverk view */

const LAWS = [
  {
    title: 'Alkohollag (2010:1622)',
    type: 'Lag',
    updated: 'Uppdaterad 2026-02-15',
    excerpt:
      'Denna lag gäller tillverkning, marknadsföring och försäljning av alkoholhaltiga drycker. Serveringstillstånd regleras i 8 kap.',
  },
  {
    title: 'Alkoholförordning (2010:1636)',
    type: 'Förordning',
    updated: 'Uppdaterad 2025-11-30',
    excerpt:
      'Kompletterande bestämmelser till alkohollagen om bland annat tillsyn, avgifter och anmälningar.',
  },
  {
    title: 'AFS 2023:2 — Planering och organisering av arbetsmiljöarbetet',
    type: 'Föreskrift',
    updated: 'Uppdaterad 2025-09-01',
    excerpt:
      'Arbetsmiljöverkets föreskrifter om systematiskt arbetsmiljöarbete, organisatorisk och social arbetsmiljö m.m.',
  },
] as const

export function RegelverkView() {
  return (
    <>
      <Breadcrumb trail={['Regelverk']} />
      <div className="mt-2">
        <h3 className="text-2xl font-semibold tracking-tight">Regelverk</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Sök i 10 000+ lagar, förordningar och föreskrifter — uppdateras varje
          dag.
        </p>
      </div>

      {/* Search bar */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">alkohollag</span>
        <span className="h-4 w-px animate-pulse bg-foreground/60" />
        <span className="ml-auto text-xs text-muted-foreground">
          312 träffar
        </span>
      </div>

      {/* Results */}
      <div className="mt-3 space-y-2.5">
        {LAWS.map((law) => (
          <div
            key={law.title}
            className="rounded-lg border border-border/70 bg-card p-3.5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/70 ring-1 ring-border/60">
                <Scale className="h-3.5 w-3.5" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {law.title}
              </span>
              <Badge tone="neutral" variant="outline">
                {law.type}
              </Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {law.excerpt}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              {law.updated} · Källa: Riksdagen
            </div>
          </div>
        ))}
      </div>

      <a
        href="/sok"
        className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        Öppna hela regelverket
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </>
  )
}

'use client'

import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Search,
  SlidersHorizontal,
  ClipboardCheck,
  Sparkles,
  FileText,
  Download,
  ArrowUp,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Clock,
  BarChart3,
  LayoutGrid,
  List,
  Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  WorkspaceViewTabs,
  WorkspaceViewTabsList,
  WorkspaceViewTabsTrigger,
} from '@/components/ui/workspace-view-tabs'
import { GroupedComplianceTable } from '@/components/features/document-list/grouped-compliance-table'
import { MarketingDocumentTable } from './marketing-document-table'
import { KanbanTab } from '@/components/features/tasks/task-workspace/kanban-tab'
import type { WorkspaceMember } from '@/components/features/tasks/task-workspace'
import { TaskApprovalRenderer } from '@/components/features/ai-chat/agent-action-renderers/task-approval-renderer'
import { SearchResultCard } from '@/components/features/search/search-result-card'
import type { SearchResult } from '@/app/actions/search'
import type { PendingAgentAction } from '@prisma/client'
import {
  MEMBERS,
  GROUPS,
  ITEMS,
  TOTAL,
  EXPANDED_GROUPS,
} from './hero-shot-data'
import { DOCUMENTS } from './styrdokument-mock-data'
import { COLUMNS as TASK_COLUMNS, TASKS } from './uppgifter-mock-data'

// Real tasks ListTab/KanbanTab member shape (reused from the showcase mocks).
const WORKSPACE_MEMBERS: WorkspaceMember[] = MEMBERS.map((m) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  avatarUrl: m.avatarUrl,
}))

// Mocked PENDING action so the assistant renders the real 14.23 approval card.
const TASK_ACTION = {
  id: 'pa-hero-1',
  status: 'PENDING',
  action_type: 'CREATE_TASK',
  params: {
    title: 'Upprätta register över utbildad serveringspersonal',
    description:
      'Skapa och underhåll ett register över vilka i personalen som genomgått utbildning i ansvarsfull alkoholservering, enligt nya 8 kap. 12 a §. Ansvarig: Anna Lindqvist.',
    priority: 'HIGH',
  },
  result_ref: null,
} as unknown as PendingAgentAction

// Tasks page tabs (same set + chrome as the real /tasks page).
const TASK_TABS = [
  { value: 'sammanfattning', label: 'Sammanfattning', icon: BarChart3 },
  { value: 'aktiva', label: 'Aktiva', icon: LayoutGrid },
  { value: 'lista', label: 'Lista', icon: List },
  { value: 'kalender', label: 'Kalender', icon: Calendar },
  { value: 'alla', label: 'Alla uppgifter', icon: Clock },
] as const

// Mock results shaped to the real `SearchResult` type so the actual
// `SearchResultCard` renders the Regelverk view exactly like the app.
const SEARCH_RESULTS: SearchResult[] = [
  {
    id: 'sr-1',
    title: 'Alkohollag (2010:1622)',
    documentNumber: 'SFS 2010:1622',
    contentType: 'SFS_LAW',
    sfsInstrument: 'LAG',
    category: null,
    summary: null,
    effectiveDate: '2011-01-01',
    status: 'ACTIVE',
    slug: 'sfs-2010-1622',
    snippet:
      'Denna lag gäller tillverkning, marknadsföring och försäljning av <mark>alkohol</mark>haltiga drycker. Serveringstillstånd regleras i 8 kap.',
    rank: 1,
  },
  {
    id: 'sr-2',
    title: 'Alkoholförordning (2010:1636)',
    documentNumber: 'SFS 2010:1636',
    contentType: 'SFS_LAW',
    sfsInstrument: 'FORORDNING',
    category: null,
    summary: null,
    effectiveDate: '2011-01-01',
    status: 'ACTIVE',
    slug: 'sfs-2010-1636',
    snippet:
      'Kompletterande bestämmelser till <mark>alkohol</mark>lagen om bland annat tillsyn, avgifter och anmälningar.',
    rank: 2,
  },
  {
    id: 'sr-3',
    title: 'AFS 2023:2 — Planering och organisering av arbetsmiljöarbetet',
    documentNumber: 'AFS 2023:2',
    contentType: 'AGENCY_REGULATION',
    sfsInstrument: null,
    category: null,
    summary: null,
    effectiveDate: '2025-01-01',
    status: 'ACTIVE',
    slug: 'afs-2023-2',
    snippet:
      'Arbetsmiljöverkets föreskrifter om systematiskt arbetsmiljöarbete, organisatorisk och social arbetsmiljö m.m.',
    rank: 3,
  },
]

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
      {/* Chat header — logo + title + history + new chat (real chat chrome) */}
      <div className="flex items-center gap-2.5 border-b border-border/70 pb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-icon-black.png"
            alt=""
            className="h-3.5 w-auto"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">Laglig-assistent</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Känner er verksamhet
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
            <Clock className="h-4 w-4" />
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/80">
            <Plus className="h-3.5 w-3.5" />
            Ny chatt
          </span>
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-2xl space-y-4">
        {/* User question */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            Vad krävs för vårt serveringstillstånd — och uppfyller vi det idag?
          </div>
        </div>

        {/* AI answer */}
        <div className="space-y-3">
          {/* tool-use trace */}
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Tänkte igenom · 3 steg · 2 s
            </div>
            {[
              'Läste Alkohollagen 8 kap.',
              'Jämförde med era kravpunkter och Alkoholpolicy',
              'Kollade personalens utbildningsstatus',
            ].map((t) => (
              <div
                key={t}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                {t}
              </div>
            ))}
          </div>

          {/* answer — mixed status, surfaces the gap */}
          <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
            <p>
              Ert serveringstillstånd är till största del i ordning — två av tre
              krav är uppfyllda. Men ett saknas sedan den senaste ändringen:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  Dokumenterade rutiner för ansvarsfull servering{' '}
                  <span className="text-muted-foreground">
                    — Alkoholpolicy v2.1
                  </span>
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Personal utbildad i ålderskontroll och servering</span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <span className="font-medium text-foreground">
                    Register över utbildad personal saknas
                  </span>{' '}
                  <span className="text-muted-foreground">
                    — nytt krav i 8 kap. 12 a §
                  </span>
                </span>
              </li>
            </ul>
            <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              Källa:
              <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70">
                <BookOpen className="h-3 w-3" />
                Alkohollag (2010:1622) · 8 kap. 12 a §
              </span>
            </p>
          </div>

          {/* Agent action card — the real 14.23 approval card (CREATE_TASK) */}
          <TaskApprovalRenderer
            action={TASK_ACTION}
            onApprove={noop}
            onReject={noop}
            onParamsChange={noop}
            isSubmitting={false}
          />
        </div>

        {/* Follow-up suggestions */}
        <div className="flex flex-wrap gap-2">
          {[
            'Vad gäller vid uteservering?',
            'När måste tillståndet förnyas?',
            'Vilka krav ställs på kassaregistret?',
          ].map((q) => (
            <span
              key={q}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/70"
            >
              {q}
            </span>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
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

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>18 av 18 krav signerade</span>
          <span>100%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-foreground" />
        </div>
      </div>

      {/* Tabs — same set as the real cycle-detail page */}
      <Tabs defaultValue="rapport" className="mt-4">
        <TabsList>
          <TabsTrigger value="items">Dokument</TabsTrigger>
          <TabsTrigger value="findings">Anmärkningar</TabsTrigger>
          <TabsTrigger value="rapport">Rapport</TabsTrigger>
          <TabsTrigger value="aktivitet">Aktivitet</TabsTrigger>
        </TabsList>
      </Tabs>

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

/* ------------------------------------------------------------ Uppgifter view
 * Renders the REAL tasks KanbanTab fed mocked tasks (same as the showcase). */

export function UppgifterView() {
  return (
    <>
      <Breadcrumb trail={['Nordviken Hotell & Konferens AB', 'Uppgifter']} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">Uppgifter</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Planera och följ upp åtgärder — kopplade till regelverken de
            uppfyller.
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <PrimaryBtn>
            <Plus className="h-3.5 w-3.5" />
            Ny uppgift
          </PrimaryBtn>
        </div>
      </div>

      {/* View tabs — same chrome as the real /tasks page */}
      <div className="mt-4">
        <WorkspaceViewTabs value="aktiva" onValueChange={noop}>
          <WorkspaceViewTabsList>
            {TASK_TABS.map(({ value, label, icon: Icon }) => (
              <WorkspaceViewTabsTrigger key={value} value={value}>
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </WorkspaceViewTabsTrigger>
            ))}
          </WorkspaceViewTabsList>
        </WorkspaceViewTabs>
      </div>

      <div className="mt-4">
        <KanbanTab
          filteredTasks={TASKS}
          initialColumns={TASK_COLUMNS}
          activeStatusFilter={[]}
          workspaceMembers={WORKSPACE_MEMBERS}
        />
      </div>
    </>
  )
}

/* -------------------------------------------------------- Styrdokument view
 * Renders the FROZEN MarketingDocumentTable fed mocked documents (28.4). */

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
            Era policyer och rutiner — kopplade till kraven de uppfyller.
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <PrimaryBtn>
            <Plus className="h-3.5 w-3.5" />
            Nytt dokument
          </PrimaryBtn>
        </div>
      </div>
      <div className="mt-4">
        <MarketingDocumentTable
          documents={DOCUMENTS}
          sortBy="updated_at"
          sortOrder="desc"
          onSort={noop}
          onArchive={noop}
        />
      </div>
    </>
  )
}

/* ----------------------------------------------------------- Regelverk view
 * Renders the REAL SearchResultCard fed mocked results. */

export function RegelverkView() {
  return (
    <>
      <div className="mt-1">
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

      {/* Results — the REAL SearchResultCard */}
      <div className="mt-4 space-y-3">
        {SEARCH_RESULTS.map((doc, i) => (
          <SearchResultCard
            key={doc.id}
            document={doc}
            query="alkohollag"
            position={i}
          />
        ))}
      </div>

      <a
        href="/sok"
        className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        Öppna hela regelverket
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </>
  )
}

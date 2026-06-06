'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import {
  ListChecks,
  Paperclip,
  Users,
  Bell,
  Sparkles,
  CircleCheck,
  ClipboardList,
  Link2,
  History,
  FileStack,
  FileCheck2,
  ShieldCheck,
  FileBadge,
  Check,
  Circle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { SectionLabel, SubLabel } from './section-label'
import { ScaledModalFrame, ShowcaseAtmosphere } from './showcase-utils'

/**
 * Feature showcase — one framed "screenshot" that SHOWS the compliance OS.
 *
 * Top-level tabs switch between the five product surfaces; each renders the
 * REAL in-app component fed mocked data inside the same scaled browser frame.
 * The frame renders at the surface's natural desktop width and scales-to-fit,
 * preserving real proportions instead of reflowing cramped.
 */

const loading = () => (
  <div className="h-full w-full animate-pulse bg-muted/20" />
)

const LawItemModalReal = dynamic(
  () => import('./law-item-modal-real').then((m) => m.LawItemModalReal),
  { ssr: false, loading }
)
const ChangeAssessmentReal = dynamic(
  () => import('./change-assessment-real').then((m) => m.ChangeAssessmentReal),
  { ssr: false, loading }
)
const UppgifterReal = dynamic(
  () => import('./uppgifter-real').then((m) => m.UppgifterReal),
  { ssr: false, loading }
)
const StyrdokumentReal = dynamic(
  () => import('./styrdokument-real').then((m) => m.StyrdokumentReal),
  { ssr: false, loading }
)
const KontrollReal = dynamic(
  () => import('./kontroll-real').then((m) => m.KontrollReal),
  { ssr: false, loading }
)

// Efterlevnad sub-tabs — swap between regelverk types (lag / föreskrift / EU).
// The heavy per-doc data lives in law-item-modal-real.
const DOC_TABS = [
  { id: 'alkohollag', name: 'Alkohollagen', kind: 'Lag' },
  { id: 'arbetsmiljolagen', name: 'Arbetsmiljölagen', kind: 'Lag' },
  { id: 'afs2023', name: 'AFS 2023:1', kind: 'Föreskrift' },
  { id: 'livsfs', name: 'Livsmedelshygien', kind: 'Föreskrift' },
  { id: 'gdpr', name: 'GDPR', kind: 'EU-förordning' },
]

type SurfaceId =
  | 'efterlevnad'
  | 'lagandringar'
  | 'uppgifter'
  | 'styrdokument'
  | 'kontroll'

interface Point {
  icon: LucideIcon
  title: string
  desc: string
}

interface Surface {
  id: SurfaceId
  tab: string
  eyebrow: string
  title: string
  desc: string
  url: string
  designWidth: number
  points: Point[]
}

const SURFACES: Surface[] = [
  {
    id: 'efterlevnad',
    tab: 'Efterlevnad',
    eyebrow: 'Efterlevnad',
    title: 'Öppna ett regelverk — bryt ner det i krav att bocka av.',
    desc: 'Lag, förordning eller föreskrift — varje post i laglistan blir en arbetsyta där efterlevnaden faktiskt sker.',
    url: 'app.laglig.se/laglistor',
    designWidth: 1280,
    points: [
      {
        icon: ListChecks,
        title: 'Kravpunkter att bocka av',
        desc: 'Bryt ner regeln i konkreta krav — bocka av det som är uppfyllt och se vad som återstår.',
      },
      {
        icon: Paperclip,
        title: 'Bevis kopplat till varje krav',
        desc: 'Fäst intyg, rutiner och dokument direkt på kravet — så finns underlaget när någon frågar.',
      },
      {
        icon: Users,
        title: 'Ansvar, status och historik',
        desc: 'Sätt ansvarig, följ efterlevnaden och se vem som gjort vad — per krav och för hela posten.',
      },
    ],
  },
  {
    id: 'lagandringar',
    tab: 'Regeländringar',
    eyebrow: 'Regeländringar',
    title: 'När en regel ändras — AI:n bedömer hur det påverkar just er.',
    desc: 'När ett regelverk på er laglista ändras får ni inte bara en notis. Laglig läser ändringen mot er verksamhet och föreslår vad ni behöver göra.',
    url: 'app.laglig.se/lagar/andringar',
    designWidth: 1280,
    points: [
      {
        icon: Bell,
        title: 'Bevakning på era regelverk',
        desc: 'Ni får besked direkt när en lag, förordning eller föreskrift på er laglista ändras.',
      },
      {
        icon: Sparkles,
        title: 'Bedömning i ert sammanhang',
        desc: 'AI:n väger ändringen mot era krav, styrdokument och ansvariga — inte bara lagtexten.',
      },
      {
        icon: CircleCheck,
        title: 'Förslag på åtgärd',
        desc: 'Konkreta uppgifter med ansvarig och deadline — redo att skapas med ett klick.',
      },
    ],
  },
  {
    id: 'uppgifter',
    tab: 'Uppgifter',
    eyebrow: 'Uppgifter',
    title: 'Koppla uppgifter till kraven — och följ upp dem.',
    desc: 'Skapa uppgifter med ansvarig och deadline, kopplade till kravpunkterna de ska uppfylla.',
    url: 'app.laglig.se/uppgifter',
    designWidth: 1280,
    points: [
      {
        icon: CircleCheck,
        title: 'Tilldela och prioritera',
        desc: 'Sätt ansvarig, prioritet och förfallodatum — och se direkt vad som är försenat.',
      },
      {
        icon: Link2,
        title: 'Kopplade till regelverken',
        desc: 'Varje uppgift vet vilket krav den uppfyller, så inget arbete tappar sitt sammanhang.',
      },
      {
        icon: ClipboardList,
        title: 'Lista, tavla eller kalender',
        desc: 'Se arbetet på det sätt som passar teamet — utan att tappa överblicken.',
      },
    ],
  },
  {
    id: 'styrdokument',
    tab: 'Styrdokument',
    eyebrow: 'Styrdokument',
    title: 'Policyer och rutiner — versionerade och kopplade till kraven.',
    desc: 'Skriv, godkänn och versionshantera era styrdokument på ett ställe — och knyt dem till de krav de uppfyller.',
    url: 'app.laglig.se/workspace/styrdokument',
    designWidth: 1340,
    points: [
      {
        icon: FileStack,
        title: 'Allt på ett ställe',
        desc: 'Policyer, rutiner, riskbedömningar och checklistor samlade och sökbara.',
      },
      {
        icon: History,
        title: 'Version och granskningsdatum',
        desc: 'Se vilken version som gäller och när dokumentet behöver granskas igen.',
      },
      {
        icon: FileCheck2,
        title: 'Godkännandeflöde',
        desc: 'Från utkast till godkänt — med spårbarhet på vem som gjort vad.',
      },
    ],
  },
  {
    id: 'kontroll',
    tab: 'Kontroll',
    eyebrow: 'Lagefterlevnadskontroll',
    title: 'Bevisa efterlevnad — med full spårbarhet på varje steg.',
    desc: 'Varje statusändring, bedömning och åtgärd loggas över tid. Genomför kontroller och visa en komplett, spårbar bild — för ledning, styrelse eller revisor.',
    url: 'app.laglig.se/laglistor/kontroller',
    designWidth: 1280,
    points: [
      {
        icon: ShieldCheck,
        title: 'Strukturerad genomgång',
        desc: 'Gå igenom kraven systematiskt och dokumentera bedömning och avvikelser.',
      },
      {
        icon: History,
        title: 'Fullständig historik',
        desc: 'Vem gjorde vad, och när — varje förändring i arbetsytan är spårbar över tid.',
      },
      {
        icon: FileBadge,
        title: 'Delbar rapport',
        desc: 'En tydlig, spårbar rapport som visar status, avvikelser och åtgärder.',
      },
    ],
  },
]

// Mobile card content — a bespoke mini-UI per surface (built for the card, not
// a screenshot crop) + a benefit title and one tight line. The snippets use the
// app's real status colours so each card reads as the actual product. The full
// product lives in the hero + the desktop interactive showcase.
const CARD_INFO: Record<SurfaceId, { title: string; desc: string }> = {
  efterlevnad: {
    title: 'Bryt ner varje regel i krav',
    desc: 'Varje post i laglistan blir en arbetsyta — lägg till kravpunkter, bocka av och koppla bevis.',
  },
  lagandringar: {
    title: 'AI bedömer varje regeländring',
    desc: 'När en regel ändras läser AI:n ändringen mot er verksamhet och föreslår vad ni behöver göra.',
  },
  uppgifter: {
    title: 'Koppla uppgifter till kraven',
    desc: 'Skapa uppgifter med ansvarig och deadline, kopplade till kravpunkterna de ska uppfylla.',
  },
  styrdokument: {
    title: 'Policyer kopplade till kraven',
    desc: 'Skriv, godkänn och versionshantera era styrdokument — kopplade till de krav de uppfyller.',
  },
  kontroll: {
    title: 'Bevisa er efterlevnad',
    desc: 'Genomför kontroller och visa en komplett, spårbar bild — för ledning, styrelse eller revisor.',
  },
}

// Shared mini-panel chrome for the card visuals — reads as a glimpse of the app.
function MiniPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full rounded-xl border border-border/70 bg-background p-3.5">
      {children}
    </div>
  )
}

function Krav({
  label,
  done,
  bevis,
}: {
  label: string
  done?: boolean
  bevis?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-[12.5px]',
        done ? 'text-foreground/75' : 'text-muted-foreground/60'
      )}
    >
      {done ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {bevis && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground/70">
          <Paperclip className="h-3 w-3" />1
        </span>
      )}
    </div>
  )
}

function DocRow({
  name,
  version,
  status,
  tone,
}: {
  name: string
  version: string
  status: string
  tone: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
      <span className="truncate text-[12px] font-medium">{name}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[10.5px] text-muted-foreground">{version}</span>
        <Pill tone={tone}>{status}</Pill>
      </div>
    </div>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
        tone
      )}
    >
      {children}
    </span>
  )
}

const CARD_CLS =
  'flex w-[80%] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03),0_14px_30px_-18px_rgb(0_0_0_/_0.14)]'

// Mirrors the real agent-proposal card (ActionRendererFrame "spine & whisper")
// so the AI suggestion reads as the same component used elsewhere in the app.
function ProposalCard() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.025)] ring-1 ring-border/45">
      <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
      <div className="py-3 pl-4 pr-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] tracking-[0.04em] text-muted-foreground">
          <span
            className="agent-dot-pending relative inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: 'hsl(var(--spine-top))' }}
          />
          <span className="font-medium">Förslag</span>
          <span className="text-muted-foreground/40">·</span>
          <span>Uppgift</span>
        </div>
        <p className="text-[13px] leading-snug text-foreground">
          Upprätta utbildningsregister för serveringspersonal
        </p>
        <div className="mt-2.5 flex items-center gap-1">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground">
            <Check className="h-3.5 w-3.5" />
            Godkänn
          </span>
          <span className="inline-flex h-7 items-center rounded-md px-2 text-[12px] text-muted-foreground">
            Avvisa
          </span>
        </div>
      </div>
    </div>
  )
}

function LogRow({
  who,
  text,
  time,
  ai,
}: {
  who: string
  text: string
  time: string
  ai?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold',
          ai
            ? 'bg-amber-400/20 text-amber-700'
            : 'bg-secondary text-foreground/70'
        )}
      >
        {who}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground/75">{text}</span>
      <span className="shrink-0 text-muted-foreground/70">{time}</span>
    </div>
  )
}

function SparbarhetVisual() {
  return (
    <MiniPanel>
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Aktivitet &amp; historik
      </div>
      <div className="space-y-2.5 text-[11.5px]">
        <LogRow who="AL" text="markerade krav som uppfyllt" time="14:12" />
        <LogRow who="EH" text="kopplade bevis till krav" time="09:41" />
        <LogRow who="AI" text="föreslog en uppgift" time="igår" ai />
        <LogRow who="AA" text="godkände förslaget" time="igår" />
        <LogRow who="AL" text="skapade kontroll Q1" time="2 dgr" />
      </div>
    </MiniPanel>
  )
}

const CARD_VISUAL: Record<SurfaceId, () => React.JSX.Element> = {
  efterlevnad: () => (
    <MiniPanel>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">Arbetsmiljölag</span>
        <Pill tone="bg-emerald-500/10 text-emerald-700">Uppfylld</Pill>
      </div>
      <div className="mt-3 space-y-2.5">
        <Krav label="Utsett skyddsombud" done bevis />
        <Krav label="Rutin för riskbedömning" done bevis />
        <Krav label="Aktuell arbetsmiljöpolicy" done />
        <Krav label="Rutin för årlig skyddsrond" />
        <Krav label="Introduktion för nyanställda" />
      </div>
      <div className="mt-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        3 av 5 kravpunkter uppfyllda
      </div>
    </MiniPanel>
  ),
  lagandringar: () => (
    <MiniPanel>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        Läste ändringen · 3 s
      </div>
      <p className="mb-3 mt-2 text-[12.5px] leading-snug text-foreground/75">
        Påverkar ert serveringstillstånd — nytt krav på utbildningsregister.
      </p>
      <ProposalCard />
    </MiniPanel>
  ),
  uppgifter: () => (
    <MiniPanel>
      <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Att göra
        </span>
        <span>3</span>
      </div>
      <div className="space-y-1.5">
        <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[12px] font-medium">
              Genomför skyddsrond Q2
            </span>
            <Pill tone="bg-amber-400/15 text-amber-700">Medel</Pill>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>SFS 1977:1160</span>
            <span>6 dagar</span>
          </div>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.04] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[12px] font-medium text-rose-700">
              Upprätta register
            </span>
            <Pill tone="bg-rose-500/10 text-rose-700">Kritisk</Pill>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-rose-700/70">
            <span>EU 2016/679</span>
            <span>20 dagar</span>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[12px] font-medium">
              Boka brandutbildning
            </span>
            <Pill tone="bg-secondary text-foreground/60">Låg</Pill>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>Lag (2003:778)</span>
            <span>14 dagar</span>
          </div>
        </div>
      </div>
    </MiniPanel>
  ),
  styrdokument: () => (
    <MiniPanel>
      <div className="divide-y divide-border/60">
        <DocRow
          name="Arbetsmiljöpolicy"
          version="v3"
          status="Godkänd"
          tone="bg-emerald-500/10 text-emerald-700"
        />
        <DocRow
          name="Riskbedömning kök"
          version="v2"
          status="Granskas"
          tone="bg-sky-500/10 text-sky-700"
        />
        <DocRow
          name="Brandskyddsplan"
          version="v1"
          status="Utkast"
          tone="bg-secondary text-foreground/60"
        />
        <DocRow
          name="Egenkontroll livsmedel"
          version="v2"
          status="Godkänd"
          tone="bg-emerald-500/10 text-emerald-700"
        />
        <DocRow
          name="Krisplan"
          version="v4"
          status="Godkänd"
          tone="bg-emerald-500/10 text-emerald-700"
        />
      </div>
    </MiniPanel>
  ),
  kontroll: () => (
    <MiniPanel>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium">18 av 20 krav granskade</span>
        <span className="text-muted-foreground">90%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-[90%] rounded-full bg-foreground" />
      </div>
      <div className="mt-3 flex gap-4 text-[11.5px] text-foreground/75">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          16 uppfyllda
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />3 avvikelser
        </span>
      </div>
      <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
        <div className="flex items-center justify-between gap-2 text-[11.5px]">
          <span className="truncate text-foreground/75">Register saknas</span>
          <Pill tone="bg-rose-500/10 text-rose-700">Hög</Pill>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11.5px]">
          <span className="truncate text-foreground/75">
            Riskbedömning ej slutförd
          </span>
          <Pill tone="bg-amber-400/15 text-amber-700">Medel</Pill>
        </div>
      </div>
    </MiniPanel>
  ),
}

export function FeatureShowcase() {
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('efterlevnad')
  const [activeDocId, setActiveDocId] = useState(DOC_TABS[0]!.id)
  // Phones get static screenshots instead of the live real components, which
  // would scale down to illegible thumbnails (and ship heavy table/dnd JS).
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const surface = SURFACES.find((s) => s.id === activeSurface) ?? SURFACES[0]!

  const body = !isDesktop ? null : surface.id === 'efterlevnad' ? (
    <LawItemModalReal key={activeDocId} docId={activeDocId} />
  ) : surface.id === 'lagandringar' ? (
    <ChangeAssessmentReal />
  ) : surface.id === 'uppgifter' ? (
    <UppgifterReal />
  ) : surface.id === 'styrdokument' ? (
    <StyrdokumentReal />
  ) : (
    <KontrollReal />
  )

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 overflow-hidden bg-background py-16 md:py-32"
    >
      {/* amber ambient wash — desktop only; on mobile it reads as an odd blob */}
      <div className="hidden md:block">
        <ShowcaseAtmosphere />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        {/* section intro — frame the whole offering before the tabs */}
        <div className="mx-auto mb-8 max-w-2xl text-center md:mb-10">
          <SectionLabel index="02" align="center" className="mb-4">
            Lösningen
          </SectionLabel>
          <h2
            className="text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Hela efterlevnaden — samlad och spårbar.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Från laglista till bevisad efterlevnad — allt på ett ställe, med
            ansvar och full historik på varje steg.{' '}
            {isDesktop
              ? 'Klicka runt i riktiga vyer ur produkten.'
              : 'Svep igenom riktiga vyer ur produkten.'}
          </p>
        </div>

        {isDesktop ? (
          <>
            {/* surface tabs — switch between the five product surfaces */}
            <div className="mx-auto mb-8 flex max-w-7xl flex-wrap justify-center gap-2 md:mb-10">
              {SURFACES.map((s) => {
                const active = s.id === activeSurface
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSurface(s.id)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm transition',
                      active
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground hover:ring-foreground/25'
                    )}
                  >
                    <span className="font-medium">{s.tab}</span>
                  </button>
                )
              })}
            </div>

            {/* copy header — tailored per surface */}
            <div className="mx-auto mb-8 grid max-w-7xl gap-6 md:mb-12 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
              <div>
                <SubLabel className="mb-5">{surface.eyebrow}</SubLabel>
                <h3
                  className="text-2xl font-medium leading-[1.12] tracking-tight md:text-3xl lg:text-[2.5rem]"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  {surface.title}
                </h3>
                <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                  {surface.desc}
                </p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-3 lg:gap-5 lg:pb-1">
                {surface.points.map((p) => (
                  <li key={p.title}>
                    <span className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground/70 ring-1 ring-border/60">
                      <p.icon className="h-4 w-4" />
                    </span>
                    <p className="text-[14px] font-medium leading-snug">
                      {p.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {p.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Efterlevnad sub-tabs — only for the efterlevnad surface */}
            {surface.id === 'efterlevnad' && (
              <div className="mx-auto mb-5 flex max-w-7xl flex-wrap gap-2">
                {DOC_TABS.map((t) => {
                  const active = t.id === activeDocId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveDocId(t.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition',
                        active
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground hover:ring-foreground/25'
                      )}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span
                        className={cn(
                          'text-[11px]',
                          active
                            ? 'text-background/60'
                            : 'text-muted-foreground/70'
                        )}
                      >
                        {t.kind}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* full-width mockup — the real surface fed mocked data */}
            <div className="mx-auto max-w-7xl">
              <ScaledModalFrame
                url={surface.url}
                designWidth={surface.designWidth}
              >
                {body}
              </ScaledModalFrame>
            </div>
          </>
        ) : (
          /* Mobile: side-scrollable, self-contained feature cards. Swiping
             changes the view in place — not a tab that alters content far down
             the page. Icon-led + tight copy (Linear-style); the real product is
             shown in the hero and the desktop interactive showcase. */
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SURFACES.map((s) => {
              const info = CARD_INFO[s.id]
              return (
                <div key={s.id} className={CARD_CLS}>
                  {/* fixed-height visual slot so titles line up across cards */}
                  <div className="mb-5 h-[224px]">{CARD_VISUAL[s.id]()}</div>
                  <h3
                    className="mb-2 text-[1.3rem] font-medium leading-snug tracking-tight"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {info.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    {info.desc}
                  </p>
                </div>
              )
            })}

            {/* traceability — a cross-cutting capability: everything is logged
                and auditable, and the history becomes context the agent builds
                on over time */}
            <div key="sparbarhet" className={CARD_CLS}>
              <div className="mb-5 h-[224px]">
                <SparbarhetVisual />
              </div>
              <h3
                className="mb-2 text-[1.3rem] font-medium leading-snug tracking-tight"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Allt loggas och är spårbart
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Varje åtgärd är granskningsbar över tid — och blir kontext som
                AI:n bygger vidare på.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

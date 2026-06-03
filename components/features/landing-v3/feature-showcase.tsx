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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
    title: 'Öppna ett regelverk — se exakt vad ni måste göra.',
    desc: 'Lag, förordning eller föreskrift — varje post i laglistan blir en arbetsyta där efterlevnaden faktiskt sker.',
    url: 'app.laglig.se/laglistor',
    designWidth: 1280,
    points: [
      {
        icon: ListChecks,
        title: 'Kravpunkter att bocka av',
        desc: 'Regeln bryts ned i konkreta krav — bocka av det som är uppfyllt och se vad som återstår.',
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
    title: 'Förvandla krav till åtgärder — och följ upp dem.',
    desc: 'Varje kravpunkt kan bli en uppgift med ansvarig och deadline, kopplad tillbaka till regeln den uppfyller.',
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

export function FeatureShowcase() {
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('efterlevnad')
  const [activeDocId, setActiveDocId] = useState(DOC_TABS[0]!.id)

  const surface = SURFACES.find((s) => s.id === activeSurface) ?? SURFACES[0]!

  const body =
    surface.id === 'efterlevnad' ? (
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
      className="relative scroll-mt-20 overflow-hidden bg-background py-24 md:py-32"
    >
      <ShowcaseAtmosphere />

      <div className="container relative z-10 mx-auto px-4">
        {/* section intro — frame the whole offering before the tabs */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Systemet för compliance
          </p>
          <h2
            className="text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Hela efterlevnaden — samlad och spårbar.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Från laglista till bevisad efterlevnad — allt på ett ställe, med
            ansvar och full historik på varje steg. Klicka runt i riktiga vyer
            ur produkten.
          </p>
        </div>

        {/* surface tabs — switch between the five product surfaces */}
        <div className="mx-auto mb-10 flex max-w-7xl flex-wrap justify-center gap-2">
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
        <div className="mx-auto mb-12 grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {surface.eyebrow}
            </p>
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
                      active ? 'text-background/60' : 'text-muted-foreground/70'
                    )}
                  >
                    {t.kind}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* full-width mockup — the real surface, fed mocked data */}
        <div className="mx-auto max-w-7xl">
          <ScaledModalFrame url={surface.url} designWidth={surface.designWidth}>
            {body}
          </ScaledModalFrame>
        </div>
      </div>
    </section>
  )
}

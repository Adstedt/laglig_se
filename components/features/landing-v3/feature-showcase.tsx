'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { ListChecks, Paperclip, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Feature showcase — large "screenshot" rows that SHOW the compliance OS.
 *
 * Efterlevnad row: the REAL law-list-item modal (`LawItemModalReal`) fed mocked
 * data. The modal is a wide desktop dialog, so it's rendered at its natural
 * width (`DESIGN_W`) and scaled to fit — preserving the real proportions
 * instead of reflowing cramped — inside a full-width browser frame.
 *
 * Once approved, the remaining surfaces (Lagändringar, Uppgifter, Styrdokument,
 * Lagefterlevnadskontroll) follow the same pattern.
 */

const LawItemModalReal = dynamic(
  () => import('./law-item-modal-real').then((m) => m.LawItemModalReal),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted/20" />,
  }
)

// Natural desktop width the modal lays out at before being scaled into the frame.
const DESIGN_W = 1280

// Light tab metadata (the heavy per-doc data lives in law-item-modal-real).
const DOC_TABS = [
  { id: 'alkohollag', name: 'Alkohollagen', kind: 'Lag' },
  { id: 'arbetsmiljolagen', name: 'Arbetsmiljölagen', kind: 'Lag' },
  { id: 'afs2023', name: 'AFS 2023:1', kind: 'Föreskrift' },
  { id: 'livsfs', name: 'Livsmedelshygien', kind: 'Föreskrift' },
  { id: 'gdpr', name: 'GDPR', kind: 'EU-förordning' },
]

function ScaledModalFrame({ url, docId }: { url: string; docId: string }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/70 bg-card ring-1 ring-foreground/[0.04]"
      style={{
        boxShadow: [
          '0 1px 2px 0 rgb(0 0 0 / 0.03)',
          '0 18px 40px -12px rgb(0 0 0 / 0.13)',
          '0 56px 100px -32px rgb(0 0 0 / 0.20)',
        ].join(', '),
      }}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border/60">
          <Lock className="h-2.5 w-2.5" />
          {url}
        </div>
      </div>
      {/* viewport — the real modal renders at DESIGN_W then scales to fit width;
          the bottom bleeds off behind a soft fade */}
      <div
        ref={viewportRef}
        className="relative h-[600px] overflow-hidden sm:h-[740px] lg:h-[840px]"
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: DESIGN_W, transform: `scale(${scale})` }}
        >
          <LawItemModalReal key={docId} docId={docId} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
      </div>
    </div>
  )
}

const POINTS = [
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
]

export function FeatureShowcase() {
  const [activeId, setActiveId] = useState(DOC_TABS[0]!.id)

  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-32">
      {/* atmosphere — faint dot texture + warm/violet ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse 60% 55% at 50% 60%, black, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 55% at 50% 60%, black, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[58%] h-[620px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-200/30 via-orange-100/15 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-10 h-72 w-[28rem] rounded-full bg-violet-300/12 blur-3xl"
      />

      <div className="container relative z-10 mx-auto px-4">
        {/* copy header */}
        <div className="mx-auto mb-12 grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Efterlevnad
            </p>
            <h2
              className="text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-5xl"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              Öppna ett regelverk — se exakt vad ni måste göra.
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Lag, förordning eller föreskrift — varje post i laglistan blir en
              arbetsyta där efterlevnaden faktiskt sker.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3 lg:gap-5 lg:pb-1">
            {POINTS.map((p) => (
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

        {/* document tabs — swap between regelverk types (lag / föreskrift / EU) */}
        <div className="mx-auto mb-5 flex max-w-7xl flex-wrap gap-2">
          {DOC_TABS.map((t) => {
            const active = t.id === activeId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
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

        {/* full-width mockup — the real modal, fed mocked data */}
        <div className="mx-auto max-w-7xl">
          <ScaledModalFrame url="app.laglig.se/laglistor" docId={activeId} />
        </div>
      </div>
    </section>
  )
}

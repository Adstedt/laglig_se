'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Scale,
  ListChecks,
  FileText,
  ClipboardCheck,
  Sparkles,
  GitCommit,
  Database,
  ShieldCheck,
  RefreshCw,
  BookOpen,
  Check,
  ArrowUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Knowledge-graph section. A radial graph of the demo workspace's compliance
 * (laws ↔ requirements ↔ documents ↔ people) wired to a central agent.
 *
 * The interaction reads as the real product: a chat composer is docked at the
 * bottom. On a loop, a question is "typed" into it, then a comet launches from
 * the composer → into the centre (Laglig) → traverses the graph stop-by-stop
 * (halting at each node with a reasoning pill / the real lagrum source) → and
 * a return comet carries the answer back down to the composer, where the
 * grounded reply rises as a 14.23-style agent-action card.
 *
 * Motion is CSS-driven (compositor-safe). The comet rides a CSS `offset-path`
 * scaled to the box in px; the same path (in viewBox units) draws as the
 * trailing line. Per-scenario keyframes (node fractions) are injected so the
 * comet's halts land exactly on the nodes.
 */

type Kind = 'agent' | 'law' | 'krav' | 'doc' | 'person' | 'audit' | 'change'

interface GNode {
  id: string
  x: number // 1000 × 920 space (nodes occupy the top ~54%)
  y: number
  kind: Kind
  label: string
  avatar?: string
  step: number
  /** subtle idle-drift variant */
  drift: number
}

const NODES: GNode[] = [
  {
    id: 'agent',
    x: 500,
    y: 350,
    kind: 'agent',
    label: 'Laglig',
    step: 0,
    drift: 0,
  },
  {
    id: 'alkohollag',
    x: 232,
    y: 122,
    kind: 'law',
    label: 'Alkohollag',
    step: 1,
    drift: 1,
  },
  {
    id: 'arbmiljolag',
    x: 768,
    y: 120,
    kind: 'law',
    label: 'Arbetsmiljölag',
    step: 1,
    drift: 2,
  },
  {
    id: 'kontroll',
    x: 506,
    y: 92,
    kind: 'audit',
    label: 'Kontroll Q1',
    step: 3,
    drift: 3,
  },
  {
    id: 'serverings',
    x: 112,
    y: 332,
    kind: 'krav',
    label: 'Serveringstillstånd',
    step: 2,
    drift: 2,
  },
  {
    id: 'sam',
    x: 888,
    y: 334,
    kind: 'krav',
    label: 'Systematiskt AM',
    step: 2,
    drift: 1,
  },
  {
    id: 'alkoholpolicy',
    x: 196,
    y: 488,
    kind: 'doc',
    label: 'Alkoholpolicy',
    step: 3,
    drift: 3,
  },
  {
    id: 'samrutin',
    x: 804,
    y: 488,
    kind: 'doc',
    label: 'SAM-rutin',
    step: 3,
    drift: 2,
  },
  {
    id: 'andring',
    x: 902,
    y: 156,
    kind: 'change',
    label: 'Ny ändring',
    step: 4,
    drift: 1,
  },
  {
    id: 'anna',
    x: 388,
    y: 434,
    kind: 'person',
    label: 'Anna',
    avatar: '/demo-team/anna.png',
    step: 4,
    drift: 2,
  },
  {
    id: 'erik',
    x: 626,
    y: 436,
    kind: 'person',
    label: 'Erik',
    avatar: '/demo-team/erik.png',
    step: 4,
    drift: 3,
  },
]

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))

const EDGES: [string, string][] = [
  ['agent', 'alkohollag'],
  ['agent', 'arbmiljolag'],
  ['agent', 'kontroll'],
  ['agent', 'serverings'],
  ['agent', 'sam'],
  ['agent', 'anna'],
  ['agent', 'erik'],
  ['alkohollag', 'serverings'],
  ['serverings', 'alkoholpolicy'],
  ['alkoholpolicy', 'anna'],
  ['arbmiljolag', 'sam'],
  ['sam', 'samrutin'],
  ['samrutin', 'erik'],
  ['arbmiljolag', 'andring'],
]

type Scenario = {
  question: string
  chain: string[] // law → krav → doc → person
  source: string
  /** short "thinking" labels shown at the krav / doc / person halts */
  reasoning: [string, string, string]
  answer: string
  action: { kind: 'task' | 'doc'; label: string }
}

const SCENARIOS: Scenario[] = [
  {
    question: 'Vad gäller för vår alkoholservering?',
    chain: ['alkohollag', 'serverings', 'alkoholpolicy', 'anna'],
    source: 'Alkohollag (2010:1622) · 8 kap. 1 §',
    reasoning: ['Kollar serveringskrav', 'Matchar er policy', 'Ansvarig: Anna'],
    answer:
      'Serveringstillstånd kräver dokumenterade rutiner — er Alkoholpolicy täcker kraven.',
    action: {
      kind: 'task',
      label: 'Skapa uppgift: utbilda serveringspersonal',
    },
  },
  {
    question: 'Är vårt systematiska arbetsmiljöarbete i fas?',
    chain: ['arbmiljolag', 'sam', 'samrutin', 'erik'],
    source: 'AFS 2023:1 · 6 § (SAM)',
    reasoning: ['Kollar SAM-status', 'Granskar rutinen', 'Ansvarig: Erik'],
    answer:
      'Ni har en SAM-rutin på plats, men årets riskbedömning saknas — komplettera den.',
    action: { kind: 'doc', label: 'Skapa styrdokument: Riskbedömning 2026' },
  },
]

const KIND_STYLE: Record<
  Kind,
  { icon: typeof Scale; ring: string; fg: string }
> = {
  agent: {
    icon: Sparkles,
    ring: 'ring-primary/30',
    fg: 'text-primary-foreground',
  },
  law: {
    icon: Scale,
    ring: 'ring-blue-500/30',
    fg: 'text-blue-600 dark:text-blue-400',
  },
  krav: {
    icon: ListChecks,
    ring: 'ring-emerald-500/30',
    fg: 'text-emerald-600 dark:text-emerald-400',
  },
  doc: { icon: FileText, ring: 'ring-border', fg: 'text-foreground/70' },
  audit: {
    icon: ClipboardCheck,
    ring: 'ring-amber-500/30',
    fg: 'text-amber-600 dark:text-amber-400',
  },
  change: {
    icon: GitCommit,
    ring: 'ring-rose-500/30',
    fg: 'text-rose-600 dark:text-rose-400',
  },
  person: { icon: Sparkles, ring: 'ring-border', fg: 'text-foreground' },
}

const beats = [
  {
    icon: Database,
    label: 'Grundat i exakta lagrum',
    sub: 'svar härleds ur era egna kopplingar',
  },
  {
    icon: ShieldCheck,
    label: 'Hämtar verkliga källor',
    sub: 'varje svar pekar på rätt SFS/AFS',
  },
  {
    icon: RefreshCw,
    label: 'Föreslår nästa steg',
    sub: 'skapar uppgifter och styrdokument',
  },
]

const VB_W = 1000
const VB_H = 920
const CY = 830 // composer anchor (comet launch/return point), in viewBox-y

const pct = (v: number, max: number) => `${(v / max) * 100}%`
const posStyle = (id: string) => ({
  left: pct(byId[id]!.x, VB_W),
  top: pct(byId[id]!.y, VB_H),
})

// Quadratic curve with a perpendicular bow → organic "web" edges.
function curve(a: GNode, b: GNode, k = 0.1) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const mx = (a.x + b.x) / 2 + (-dy / len) * len * k
  const my = (a.y + b.y) / 2 + (dx / len) * len * k
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

// Comet/query path: composer → agent → chain (law → krav → doc → person).
// `s` scales every coordinate (1 = viewBox units for the SVG line; W/1000 for
// the comet's px offset-path). `k` MUST match the edge bow (see `curve`) so the
// orange line sits exactly on the grey edges instead of beside them.
function cometPath(chain: string[], s: number, k = 0.1) {
  const f = (n: number) => +(n * s).toFixed(1)
  const pts = ['agent', ...chain].map((id) => byId[id]!)
  let d = `M ${f(500)} ${f(CY)} L ${f(500)} ${f(350)}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const cx = (a.x + b.x) / 2 + (-dy / len) * len * k
    const cy = (a.y + b.y) / 2 + (dx / len) * len * k
    d += ` Q ${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`
  }
  return d
}

// Return path: person → (via agent) → composer.
function returnPath(personId: string, s: number) {
  const f = (n: number) => +(n * s).toFixed(1)
  const p = byId[personId]!
  return `M ${f(p.x)} ${f(p.y)} Q ${f(500)} ${f(350)} ${f(500)} ${f(CY)}`
}

// Cumulative length fractions (%) at composer, agent, law, krav, doc, person.
function fractions(chain: string[]) {
  const pts = [
    { x: 500, y: CY },
    byId['agent']!,
    ...chain.map((id) => byId[id]!),
  ]
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
    seg.push(l)
    total += l
  }
  const cum = [0]
  for (let i = 0; i < seg.length; i++) cum.push(cum[i]! + seg[i]!)
  return cum.map((c) => +((c / total) * 100).toFixed(2)) // [0, fAgent, fLaw, fKrav, fDoc, 100]
}

const LOOP_MS = 12000

export function KnowledgeGraphSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [started, setStarted] = useState(false)
  const [scenario, setScenario] = useState(0)
  const [w, setW] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setStarted(true), 1300)
    return () => clearTimeout(t)
  }, [inView])

  useEffect(() => {
    if (!started) return
    const iv = setInterval(
      () => setScenario((s) => (s + 1) % SCENARIOS.length),
      LOOP_MS
    )
    return () => clearInterval(iv)
  }, [started])

  const sc = SCENARIOS[scenario]!
  const lawNode = byId[sc.chain[0]!]!
  const personNode = byId[sc.chain[sc.chain.length - 1]!]!
  const lawLeft = lawNode.x < 500
  const actionLabel = sc.action.kind === 'task' ? 'Uppgift' : 'Styrdokument'

  const scale = w > 0 ? w / VB_W : 0
  const fr = fractions(sc.chain)
  const off = (i: number) => fr[i]!
  const dash = (i: number) => +(1 - fr[i]! / 100).toFixed(3)

  // Per-scenario keyframes: the comet's offset-distance halts on each node,
  // and the trailing line's dashoffset tracks it exactly.
  const dynStyles = `
@keyframes kg-comet {
  0%, 10% { offset-distance: 0%; opacity: 0; }
  11%     { opacity: 1; }
  16%     { offset-distance: ${off(1)}%; }
  18.5%   { offset-distance: ${off(1)}%; }
  26%     { offset-distance: ${off(2)}%; }
  30%     { offset-distance: ${off(2)}%; }
  37%     { offset-distance: ${off(3)}%; }
  41%     { offset-distance: ${off(3)}%; }
  48%     { offset-distance: ${off(4)}%; }
  52%     { offset-distance: ${off(4)}%; }
  59%     { offset-distance: 100%; }
  62%     { offset-distance: 100%; opacity: 1; }
  66%,100%{ offset-distance: 100%; opacity: 0; }
}
@keyframes kg-line {
  0%, 10% { stroke-dashoffset: 1; opacity: 0; }
  11%     { opacity: 1; }
  16%     { stroke-dashoffset: ${dash(1)}; }
  18.5%   { stroke-dashoffset: ${dash(1)}; }
  26%     { stroke-dashoffset: ${dash(2)}; }
  30%     { stroke-dashoffset: ${dash(2)}; }
  37%     { stroke-dashoffset: ${dash(3)}; }
  41%     { stroke-dashoffset: ${dash(3)}; }
  48%     { stroke-dashoffset: ${dash(4)}; }
  52%     { stroke-dashoffset: ${dash(4)}; }
  59%     { stroke-dashoffset: 0; opacity: 1; }
  66%     { stroke-dashoffset: 0; opacity: 1; }
  72%     { stroke-dashoffset: 0; opacity: 0.26; }
  90%     { stroke-dashoffset: 0; opacity: 0.26; }
  96%,100%{ stroke-dashoffset: 0; opacity: 0; }
}
@keyframes kg-return {
  0%, 60% { offset-distance: 0%; opacity: 0; }
  62%     { opacity: 1; }
  69%     { offset-distance: 100%; opacity: 1; }
  72%,100%{ offset-distance: 100%; opacity: 0; }
}`

  return (
    <section
      className="relative overflow-hidden bg-section-cream py-20 md:py-28"
      style={{ ['--kg-dur' as string]: '12s' }}
    >
      <style>{kgStyles}</style>

      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-16">
          {/* Copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Personlig kunskapsgraf
            </span>
            <h2
              className="mt-5 text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-[2.75rem]"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              En agent som känner
              <span className="block text-foreground/45">
                hela er efterlevnad.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-base text-muted-foreground md:text-lg">
              Generiska AI-verktyg gissar. Laglig bygger en levande kunskapsgraf
              av er verksamhet — lagar, krav, styrdokument och ansvariga kopplas
              samman. Agenten svarar grundat i exakta lagrum, och föreslår nästa
              steg.
            </p>
            <ul className="mt-8 space-y-4">
              {beats.map((b) => (
                <li key={b.label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-foreground/70 ring-1 ring-border">
                    <b.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {b.label}
                    </p>
                    <p className="text-sm text-muted-foreground">{b.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Graph + docked chat */}
          <div
            ref={ref}
            className={cn('kg-stage relative w-full', inView && 'kg-in')}
          >
            <div className="relative aspect-[1000/920] w-full">
              {/* Edges (static) + query line (re-keyed per scenario) */}
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden
              >
                <defs>
                  <radialGradient id="kg-core" cx="50%" cy="50%" r="50%">
                    <stop
                      offset="0%"
                      stopColor="hsl(40 60% 90%)"
                      stopOpacity="0.85"
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(40 60% 90%)"
                      stopOpacity="0"
                    />
                  </radialGradient>
                </defs>

                <circle
                  cx="500"
                  cy="350"
                  r="240"
                  fill="url(#kg-core)"
                  className="kg-corewash"
                />

                {EDGES.map(([a, b]) => (
                  <path
                    key={`${a}-${b}`}
                    d={curve(byId[a]!, byId[b]!)}
                    pathLength={1}
                    className="kg-edge"
                  />
                ))}

                {started && (
                  <path
                    key={scenario}
                    d={cometPath(sc.chain, 1)}
                    pathLength={1}
                    className="kg-queryline"
                  />
                )}
              </svg>

              {/* Nodes (static — build in once, gentle idle drift) */}
              {NODES.map((n) => {
                const s = KIND_STYLE[n.kind]
                const Icon = s.icon
                const isAgent = n.kind === 'agent'
                const isPerson = n.kind === 'person'
                return (
                  <div
                    key={n.id}
                    className="kg-node absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      ...posStyle(n.id),
                      ['--d' as string]: `${0.15 + n.step * 0.1}s`,
                    }}
                  >
                    <div className={`kg-float kg-float-${n.drift}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        {isAgent ? (
                          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/15">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/logo-icon-white.png"
                              alt="Laglig"
                              className="h-7 w-auto"
                            />
                            <span className="kg-corepulse absolute inset-0 rounded-2xl ring-2 ring-primary/40" />
                          </div>
                        ) : isPerson ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={n.avatar}
                            alt=""
                            className="h-11 w-11 rounded-full bg-card object-cover shadow-sm ring-2 ring-card"
                          />
                        ) : (
                          <div
                            className={cn(
                              'flex h-11 w-11 items-center justify-center rounded-xl bg-card shadow-sm ring-1',
                              s.fg,
                              s.ring
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                        )}
                        {!isAgent && (
                          <span className="whitespace-nowrap rounded-md bg-card/85 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                            {n.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Per-scenario layer (re-keyed → animations replay) */}
              {started && (
                <div key={scenario}>
                  <style>{dynStyles}</style>

                  {/* Stop glows — bloom as the comet lands on each chain node */}
                  {sc.chain.map((id, i) => (
                    <span
                      key={id}
                      className={cn(
                        'kg-glow absolute z-[9] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full',
                        `kg-s${i + 1}`
                      )}
                      style={posStyle(id)}
                      aria-hidden
                    />
                  ))}

                  {/* Reasoning halts — small "thinking" pills at krav / doc / person */}
                  {[sc.chain[1]!, sc.chain[2]!, sc.chain[3]!].map((id, i) => (
                    <span
                      key={id}
                      className={cn(
                        'kg-pill absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-amber-300/60 bg-card px-2 py-0.5 text-[10.5px] font-medium text-amber-700 shadow-sm dark:bg-amber-500/10 dark:text-amber-300',
                        `kg-p${i + 1}`
                      )}
                      style={{
                        left: posStyle(id).left,
                        top: `calc(${posStyle(id).top} - 40px)`,
                      }}
                    >
                      {sc.reasoning[i]}
                    </span>
                  ))}

                  {/* Source citation — pops at the law node as the comet arrives */}
                  <div
                    className="kg-src absolute z-20 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300/70 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 shadow-sm"
                    style={{
                      top: `calc(${posStyle(sc.chain[0]!).top} + 52px)`,
                      ...(lawLeft
                        ? { left: posStyle(sc.chain[0]!).left }
                        : { right: pct(VB_W - lawNode.x, VB_W) }),
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                    {sc.source}
                  </div>

                  {/* Comet (rides the px offset-path) + return comet */}
                  {scale > 0 && (
                    <>
                      <span
                        className="kg-comet"
                        style={{
                          offsetPath: `path('${cometPath(sc.chain, scale)}')`,
                        }}
                        aria-hidden
                      />
                      <span
                        className="kg-return"
                        style={{
                          offsetPath: `path('${returnPath(personNode.id, scale)}')`,
                        }}
                        aria-hidden
                      />
                    </>
                  )}

                  {/* Grounded reply — rises above the composer (14.23 spine card) */}
                  <div className="kg-a absolute bottom-[13%] left-1/2 z-20 w-[62%] max-w-[366px] -translate-x-1/2">
                    <div className="relative overflow-hidden rounded-xl bg-card shadow-[0_8px_28px_-8px_rgba(0,0,0,0.18)] ring-1 ring-border/55">
                      <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
                      <div className="py-2.5 pl-4 pr-3">
                        {/* grounded answer */}
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Grundat svar
                        </div>
                        <p className="text-[12.5px] leading-snug text-foreground">
                          {sc.answer}
                        </p>
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-300/60 bg-amber-50/60 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <BookOpen className="h-3 w-3" /> {sc.source}
                        </span>

                        {/* proposed next step — whisper eyebrow + footer */}
                        <div className="mt-3 border-t border-border/45 pt-2.5">
                          <div className="mb-1 flex items-center gap-2 text-[11px] tracking-[0.04em] text-muted-foreground">
                            <span
                              className="agent-dot-pending relative inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                              style={{ background: 'hsl(var(--spine-top))' }}
                            />
                            <span className="font-medium">Förslag</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>{actionLabel}</span>
                          </div>
                          <p className="text-[12.5px] leading-snug text-foreground">
                            {sc.action.label}
                          </p>
                          <div className="mt-2.5 flex items-center gap-1">
                            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground">
                              <Check className="h-3.5 w-3.5" /> Godkänn
                            </span>
                            <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground">
                              Avvisa
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chat composer — the anchor the query leaves from and the
                      reply returns to */}
                  <div className="kg-composer absolute bottom-[2.5%] left-1/2 z-30 w-[66%] max-w-[400px] -translate-x-1/2">
                    <div className="flex items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-2.5 pr-2 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.22)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={personNode.avatar}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
                      />
                      <div className="relative min-w-0 flex-1 text-[12.5px] leading-none">
                        <span className="kg-cdots absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="kg-qtext block truncate text-foreground">
                          {sc.question}
                        </span>
                      </div>
                      <span className="kg-send flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const kgStyles = `
.kg-edge {
  stroke: hsl(var(--foreground) / 0.12);
  stroke-width: 1.5;
  fill: none;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.kg-in .kg-edge { animation: kg-draw 0.9s ease forwards; }
@keyframes kg-draw { to { stroke-dashoffset: 0; } }

.kg-queryline {
  stroke: hsl(38 92% 50%);
  stroke-width: 2.5; fill: none; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0;
  filter: drop-shadow(0 0 5px hsl(38 92% 50% / 0.6));
  animation: kg-line var(--kg-dur, 12s) linear forwards;
}

.kg-corewash { opacity: 0; }
.kg-in .kg-corewash { animation: kg-fade 1.2s ease 0.2s forwards; }
@keyframes kg-fade { to { opacity: 1; } }

.kg-node { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
.kg-in .kg-node { animation: kg-pop 0.6s cubic-bezier(0.2,1,0.3,1) forwards; animation-delay: var(--d); }
@keyframes kg-pop { to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

/* gentle idle drift — small enough that the opaque node still masks its edge ends */
.kg-float { animation: kg-float 7s ease-in-out infinite; }
.kg-float-1 { animation-duration: 6.5s; animation-delay: -1s; }
.kg-float-2 { animation-duration: 8s; animation-delay: -3s; }
.kg-float-3 { animation-duration: 7.5s; animation-delay: -5s; }
@keyframes kg-float { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0,-5px); } }

.kg-corepulse { animation: kg-ring 3.5s ease-in-out infinite; }
@keyframes kg-ring { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0; transform: scale(1.25); } }

/* comet — rides the px offset-path; its center sits on the path */
.kg-comet {
  position: absolute; left: 0; top: 0;
  width: 13px; height: 13px; border-radius: 9999px;
  offset-anchor: 50% 50%; offset-rotate: 0deg;
  background: radial-gradient(circle, hsl(45 95% 70%), hsl(38 92% 52%) 70%);
  box-shadow: 0 0 12px 3px hsl(38 92% 50% / 0.7);
  opacity: 0; z-index: 15;
  animation: kg-comet var(--kg-dur, 12s) cubic-bezier(0.45,0,0.25,1) forwards;
}
.kg-return {
  position: absolute; left: 0; top: 0;
  width: 11px; height: 11px; border-radius: 9999px;
  offset-anchor: 50% 50%; offset-rotate: 0deg;
  background: radial-gradient(circle, hsl(45 95% 72%), hsl(38 92% 54%) 70%);
  box-shadow: 0 0 10px 2px hsl(38 92% 50% / 0.6);
  opacity: 0; z-index: 15;
  animation: kg-return var(--kg-dur, 12s) cubic-bezier(0.4,0,0.2,1) forwards;
}

/* stop glows: a soft amber halo blooming as the comet lands on each node */
.kg-glow {
  background: radial-gradient(closest-side, hsl(38 92% 50% / 0.55), transparent);
  opacity: 0; transform: translate(-50%, -50%) scale(0.5);
}
.kg-s1 { animation: kg-stop1 var(--kg-dur, 12s) ease forwards; }
.kg-s2 { animation: kg-stop2 var(--kg-dur, 12s) ease forwards; }
.kg-s3 { animation: kg-stop3 var(--kg-dur, 12s) ease forwards; }
.kg-s4 { animation: kg-stop4 var(--kg-dur, 12s) ease forwards; }
@keyframes kg-stop1 {
  0%,24%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  27%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  31%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  90%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  96%,100% { opacity: 0; }
}
@keyframes kg-stop2 {
  0%,35%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  38%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  42%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  90%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  96%,100% { opacity: 0; }
}
@keyframes kg-stop3 {
  0%,46%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  49%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  53%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  90%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  96%,100% { opacity: 0; }
}
@keyframes kg-stop4 {
  0%,57%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  60%      { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
  64%      { opacity: 0.55; transform: translate(-50%,-50%) scale(0.98); }
  90%      { opacity: 0.45; transform: translate(-50%,-50%) scale(0.98); }
  96%,100% { opacity: 0; }
}

/* reasoning halts — blink in at each node as the comet lands, hold faint */
.kg-pill { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
.kg-p1 { animation: kg-pill1 var(--kg-dur, 12s) ease forwards; }
.kg-p2 { animation: kg-pill2 var(--kg-dur, 12s) ease forwards; }
.kg-p3 { animation: kg-pill3 var(--kg-dur, 12s) ease forwards; }
/* transient — each thought blinks in at its node, then clears before the
   reply card lands so the resting frame stays uncluttered */
@keyframes kg-pill1 {
  0%,36%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  40%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  56%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  62%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}
@keyframes kg-pill2 {
  0%,47%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  51%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  64%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  69%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}
@keyframes kg-pill3 {
  0%,58%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  62%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  70%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  74%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}

.kg-src { opacity: 0; animation: kg-srcchip var(--kg-dur, 12s) ease forwards; }
@keyframes kg-srcchip {
  0%,26%   { opacity: 0; }
  30%      { opacity: 1; }
  68%      { opacity: 1; }
  /* hands the source off to the reply card's own chip */
  74%,100% { opacity: 0; }
}

/* composer: typing dots → typed question, with a send "press" */
.kg-cdots { opacity: 0; animation: kg-cdots var(--kg-dur, 12s) ease forwards; }
@keyframes kg-cdots {
  0%       { opacity: 0; }
  1.5%     { opacity: 1; }
  6%       { opacity: 1; }
  7.5%,100%{ opacity: 0; }
}
.kg-cdots i {
  display: inline-block; width: 5px; height: 5px; border-radius: 9999px;
  background: hsl(var(--muted-foreground)); animation: kg-bounce 1.1s ease-in-out infinite;
}
.kg-cdots i:nth-child(2) { animation-delay: 0.15s; }
.kg-cdots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes kg-bounce {
  0%,80%,100% { transform: translateY(0); opacity: 0.4; }
  40%         { transform: translateY(-3px); opacity: 1; }
}
.kg-qtext { opacity: 0; animation: kg-qtext var(--kg-dur, 12s) ease forwards; }
@keyframes kg-qtext {
  0%,6%    { opacity: 0; }
  9%       { opacity: 1; }
  90%      { opacity: 1; }
  96%,100% { opacity: 0; }
}
.kg-send { transform: scale(1); animation: kg-send var(--kg-dur, 12s) ease forwards; }
@keyframes kg-send {
  0%,8%   { transform: scale(1); }
  9.5%    { transform: scale(0.8); }
  11%     { transform: scale(1); }
  100%    { transform: scale(1); }
}

.kg-a { opacity: 0; transform: translate(-50%, 10px); animation: kg-achip var(--kg-dur, 12s) ease forwards; }
@keyframes kg-achip {
  0%,67%   { opacity: 0; transform: translate(-50%, 10px); }
  74%      { opacity: 1; transform: translate(-50%, 0); }
  90%      { opacity: 1; transform: translate(-50%, 0); }
  96%,100% { opacity: 0; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .kg-edge, .kg-queryline, .kg-node, .kg-corewash {
    animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important;
    transform: translate(-50%, -50%) scale(1) !important;
  }
  .kg-corepulse, .kg-float, .kg-glow, .kg-cdots i, .kg-comet, .kg-return { animation: none !important; }
  .kg-comet, .kg-return { opacity: 0 !important; }
  .kg-glow { opacity: 0.45 !important; transform: translate(-50%,-50%) scale(1) !important; }
  .kg-cdots { animation: none !important; opacity: 0 !important; }
  .kg-pill { animation: none !important; opacity: 0.85 !important; transform: translate(-50%,-50%) scale(1) !important; }
  .kg-qtext, .kg-src, .kg-send { animation: none !important; opacity: 1 !important; transform: none !important; }
  .kg-a { animation: none !important; opacity: 1 !important; transform: translate(-50%, 0) !important; }
}
`

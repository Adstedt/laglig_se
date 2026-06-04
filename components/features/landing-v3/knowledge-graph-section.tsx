'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Scale,
  ListChecks,
  FileText,
  ClipboardCheck,
  Sparkles,
  GitCommit,
  ShieldCheck,
  BookOpen,
  Check,
  ArrowUp,
  Paperclip,
  PencilLine,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Knowledge-graph section. Header band (eyebrow + heading + USPs) on top, then a
 * side-by-side exchange: a real chat window on the left and the compliance graph
 * on the right.
 *
 * On a loop: a question is "typed" into the chat composer and posted as a user
 * message; a comet beams out of the graph's chat-facing edge, up to the Laglig
 * agent and through the graph stop-by-stop (real lagrum source + reasoning
 * halts); a return comet carries the answer back, and the grounded reply lands
 * in the chat thread directly under the question (14.23 agent-action card).
 *
 * Motion is CSS-driven (compositor-safe). The comet rides a CSS `offset-path`
 * scaled to the box in px; the same path (in viewBox units) draws as the
 * trailing line. Per-scenario keyframes (node fractions) are injected so the
 * comet's halts land exactly on the nodes, and the comet dims at each halt so
 * the node glow takes over (no dot parked on an icon).
 */

type Kind = 'agent' | 'law' | 'krav' | 'doc' | 'person' | 'audit' | 'change'

interface GNode {
  id: string
  x: number // 1000 × 600 space
  y: number
  kind: Kind
  label: string
  avatar?: string
  step: number
  /** subtle idle-drift variant */
  drift: number
}

// Layout opens toward the LEFT: the agent sits at the left-center hinge and both
// topic chains fan rightward with generous, even spacing so every node + label
// reads clearly. Nothing sits in the entry corridor (left of the agent, y≈300).
// Agent at the left (chat-facing). Three topic branches fan out — alkohol
// (top), brandskydd (middle), arbetsmiljö (bottom) — each flowing lag → krav →
// styrdokument → ansvarig. The Q1 audit weaves the top two and the amendment
// weaves the bottom two, so the whole thing reads as a connected mesh.
const NODES: GNode[] = [
  {
    id: 'agent',
    x: 208,
    y: 380,
    kind: 'agent',
    label: 'Laglig',
    step: 0,
    drift: 0,
  },
  // alkohol branch — sweeps up
  {
    id: 'alkohollag',
    x: 372,
    y: 212,
    kind: 'law',
    label: 'Alkohollag',
    step: 1,
    drift: 1,
  },
  {
    id: 'serverings',
    x: 560,
    y: 118,
    kind: 'krav',
    label: 'Serveringstillstånd',
    step: 2,
    drift: 2,
  },
  {
    id: 'alkoholpolicy',
    x: 766,
    y: 172,
    kind: 'doc',
    label: 'Alkoholpolicy',
    step: 3,
    drift: 3,
  },
  {
    id: 'anna',
    x: 922,
    y: 250,
    kind: 'person',
    label: 'Anna',
    avatar: '/demo-team/anna.webp',
    step: 4,
    drift: 2,
  },
  // brandskydd branch — middle, gently staggered so labels never share a row
  {
    id: 'brandskydd',
    x: 398,
    y: 402,
    kind: 'law',
    label: 'Brandskydd',
    step: 1,
    drift: 3,
  },
  {
    id: 'sba',
    x: 610,
    y: 348,
    kind: 'krav',
    label: 'Systematiskt brandskydd',
    step: 2,
    drift: 1,
  },
  {
    id: 'brandpolicy',
    x: 806,
    y: 414,
    kind: 'doc',
    label: 'Brandskyddspolicy',
    step: 3,
    drift: 2,
  },
  {
    id: 'johan',
    x: 938,
    y: 344,
    kind: 'person',
    label: 'Johan',
    avatar: '/demo-team/johan.webp',
    step: 4,
    drift: 1,
  },
  // arbetsmiljö branch — sweeps down
  {
    id: 'arbmiljolag',
    x: 372,
    y: 558,
    kind: 'law',
    label: 'Arbetsmiljölag',
    step: 1,
    drift: 2,
  },
  {
    id: 'sam',
    x: 560,
    y: 652,
    kind: 'krav',
    label: 'Systematiskt AM',
    step: 2,
    drift: 1,
  },
  {
    id: 'samrutin',
    x: 766,
    y: 598,
    kind: 'doc',
    label: 'SAM-rutin',
    step: 3,
    drift: 2,
  },
  {
    id: 'erik',
    x: 922,
    y: 528,
    kind: 'person',
    label: 'Erik',
    avatar: '/demo-team/erik.webp',
    step: 4,
    drift: 3,
  },
  // connective nodes — audit weaves the top two, amendment weaves the bottom two
  {
    id: 'kontroll',
    x: 512,
    y: 214,
    kind: 'audit',
    label: 'Kontroll Q1',
    step: 3,
    drift: 3,
  },
  {
    id: 'andring',
    x: 540,
    y: 484,
    kind: 'change',
    label: 'Ny ändring',
    step: 4,
    drift: 1,
  },
]

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))

// An interconnected graph (not a flat tree, not a spoke-everything tangle).
// The agent + the Q1 audit act as two connective hubs that weave the two topic
// branches together with real relations: the audit reviews both laws and both
// requirements; the amendment touches its law and the requirement it changes.
// This gives loops/triangles (a "web of relations") without the redundant
// person-spokes that crossed the middle.
const EDGES: [string, string][] = [
  // agent hub — links to the three law roots + the audit
  ['agent', 'alkohollag'],
  ['agent', 'brandskydd'],
  ['agent', 'arbmiljolag'],
  ['agent', 'kontroll'],
  // audit weaves the top two domains
  ['kontroll', 'alkohollag'],
  ['kontroll', 'brandskydd'],
  ['kontroll', 'serverings'],
  // amendment weaves the bottom two domains
  ['andring', 'arbmiljolag'],
  ['andring', 'brandskydd'],
  ['andring', 'sam'],
  // alkohol branch
  ['alkohollag', 'serverings'],
  ['serverings', 'alkoholpolicy'],
  ['alkoholpolicy', 'anna'],
  // brandskydd branch
  ['brandskydd', 'sba'],
  ['sba', 'brandpolicy'],
  ['brandpolicy', 'johan'],
  // arbetsmiljö branch
  ['arbmiljolag', 'sam'],
  ['sam', 'samrutin'],
  ['samrutin', 'erik'],
]

type Scenario = {
  question: string
  chain: string[] // law → krav → doc → person
  source: string
  /** short "thinking" labels shown at the krav / doc / person halts */
  reasoning: [string, string, string]
  /** brief conversational lead-in shown before the grounded-answer card */
  intro: string
  answer: string
  action: { kind: 'task' | 'doc'; label: string }
}

const SCENARIOS: Scenario[] = [
  {
    question: 'Vad gäller för vår alkoholservering?',
    chain: ['alkohollag', 'serverings', 'alkoholpolicy', 'anna'],
    source: 'Alkohollag (2010:1622) · 8 kap. 1 §',
    reasoning: ['Kollar serveringskrav', 'Matchar er policy', 'Ansvarig: Anna'],
    intro:
      'Jag följde kopplingarna från Alkohollagen till era egna rutiner — här är vad jag hittade:',
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
    intro:
      'Jag stämde av ert systematiska arbetsmiljöarbete mot AFS 2023:1 — så här ser det ut:',
    answer:
      'Ni har en SAM-rutin på plats, men årets riskbedömning saknas — komplettera den.',
    action: { kind: 'doc', label: 'Skapa styrdokument: Riskbedömning 2026' },
  },
  {
    question: 'Är vårt brandskyddsarbete i ordning?',
    chain: ['brandskydd', 'sba', 'brandpolicy', 'johan'],
    source: 'LSO (2003:778) · 2 kap. 2 §',
    reasoning: ['Kollar brandskyddskrav', 'Granskar SBA', 'Ansvarig: Johan'],
    intro:
      'Jag gick igenom ert brandskyddsarbete mot LSO och er SBA-rutin — här är läget:',
    answer:
      'Ert systematiska brandskyddsarbete är dokumenterat — men brandskyddskontrollen för Q2 är försenad.',
    action: { kind: 'task', label: 'Skapa uppgift: boka brandskyddskontroll' },
  },
  // Change-assessment flow: a new amendment to the arbetsmiljö föreskrifter →
  // the agent reads the ändring, traces which krav + styrdokument it touches,
  // and proposes the fix. Traverses the otherwise-decorative "Ny ändring" node
  // (every hop lies on a real edge: arbmiljolag→andring→sam→samrutin).
  {
    question:
      'Vad innebär den nya ändringen i arbetsmiljöföreskrifterna för oss?',
    chain: ['arbmiljolag', 'andring', 'sam', 'samrutin'],
    source: 'AFS 2023:1 · 6 § (ändrad)',
    reasoning: ['Läser ändringen', 'Påverkar SAM-kravet', 'Berör SAM-rutinen'],
    intro:
      'En ny ändring i Arbetsmiljöverkets föreskrifter rör ert systematiska arbetsmiljöarbete — så här bedömer jag den:',
    answer:
      'Ändringen skärper kraven på årlig riskbedömning. Er SAM-rutin täcker inte det nya kravet ännu — den behöver uppdateras.',
    action: {
      kind: 'task',
      label: 'Skapa uppgift: uppdatera riskbedömning enligt nya kravet',
    },
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
    ring: 'ring-black/10',
    fg: 'text-neutral-700',
  },
  krav: {
    icon: ListChecks,
    ring: 'ring-emerald-500/40',
    fg: 'text-emerald-600',
  },
  doc: { icon: FileText, ring: 'ring-black/10', fg: 'text-neutral-500' },
  audit: {
    icon: ClipboardCheck,
    ring: 'ring-amber-500/40',
    fg: 'text-amber-600',
  },
  change: {
    icon: GitCommit,
    ring: 'ring-black/10',
    fg: 'text-neutral-700',
  },
  person: { icon: Sparkles, ring: 'ring-border', fg: 'text-foreground' },
}

// Swedish kind labels for the mobile tool-use trace rows
const TRACE_KIND_LABEL: Record<Kind, string> = {
  agent: 'Agent',
  law: 'Lag',
  krav: 'Krav',
  doc: 'Styrdokument',
  audit: 'Kontroll',
  change: 'Ändring',
  person: 'Ansvarig',
}

const VB_W = 1000
const VB_H = 760
// where the query line starts — pulled well left of the graph (negative x) so,
// with the chat sitting above it (z-10), the line emerges from BEHIND the chat
// window rather than from a gap to its right
const PORT = { x: -190, y: 380 }

// the person chatting with Laglig (kept consistent across all user messages so
// it reads as one compliance manager, distinct from the graph's responsibles)
const ASKER_AVATAR = '/demo-team/sofia.webp'

const pct = (v: number, max: number) => `${(v / max) * 100}%`
const posStyle = (id: string) => ({
  left: pct(byId[id]!.x, VB_W),
  top: pct(byId[id]!.y, VB_H),
})

// Quadratic curve with a perpendicular bow → organic "web" edges.
function curve(
  a: { x: number; y: number },
  b: { x: number; y: number },
  k = 0.1
) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const mx = (a.x + b.x) / 2 + (-dy / len) * len * k
  const my = (a.y + b.y) / 2 + (dx / len) * len * k
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

// Comet/query path: port → agent → chain (law → krav → doc → person).
// `s` scales every coordinate (1 = viewBox units for the SVG line; W/1000 for
// the comet's px offset-path). `k` matches the edge bow so the orange line sits
// exactly on the grey edges instead of beside them.
function cometPath(chain: string[], s: number, k = 0.1) {
  const f = (n: number) => +(n * s).toFixed(1)
  const pts = [PORT, byId['agent']!, ...chain.map((id) => byId[id]!)]
  let d = `M ${f(pts[0]!.x)} ${f(pts[0]!.y)}`
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

// Cumulative length fractions (%) at port, agent, law, krav, doc, person.
function fractions(chain: string[]) {
  const pts = [PORT, byId['agent']!, ...chain.map((id) => byId[id]!)]
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

// A few clean tendrils reaching out from the agent into the surrounding dark,
// where they meet the large background web — so the labeled graph is visibly
// plugged into the bigger graph. Spread + angled to avoid the horizontal query
// line (left) and the labeled cluster (right).
const AGENT_TENDRILS: [number, number][] = [
  [-150, 80],
  [-170, 690],
  [260, 880],
  [560, 905],
]

const LOOP_MS = 13000

function AgentGlyph({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-neutral-900 ring-1 ring-white/10',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-icon-white.png"
        alt="Laglig"
        className="h-3.5 w-auto"
      />
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-end justify-end gap-2">
      <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[12.5px] leading-snug text-primary-foreground shadow-sm">
        {text}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASKER_AVATAR}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    </div>
  )
}

// The grounded-answer card body (eyebrow → answer → source → proposal → actions).
function ReplyCardInner({ sc }: { sc: Scenario }) {
  const actionLabel = sc.action.kind === 'task' ? 'Uppgift' : 'Styrdokument'
  return (
    <>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Grundat svar
      </div>
      <p className="text-[12.5px] leading-snug text-foreground">{sc.answer}</p>
      <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-300/60 bg-amber-50/60 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <BookOpen className="h-3 w-3" /> {sc.source}
      </span>
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
    </>
  )
}

// One question → grounded-answer exchange. When `animate`, the card builds live
// (search status → composing shimmer → answer). Otherwise it's the finished
// card, which persists in the thread as the conversation keeps scrolling.
function Exchange({ sc, animate }: { sc: Scenario; animate?: boolean }) {
  return (
    <>
      {animate ? (
        <div className="kg-uslot">
          {/* the asker composing — typing dots before the question lands */}
          <div className="kg-ph kg-utyping grid">
            <div>
              <div className="flex items-end justify-end gap-2">
                <div className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-3 shadow-sm">
                  <span className="kg-dots kg-dots-light inline-flex items-center gap-1">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ASKER_AVATAR}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
                />
              </div>
            </div>
          </div>
          {/* the question — expands in as the typing collapses */}
          <div className="kg-ph kg-uquestion grid">
            <div>
              <UserBubble text={sc.question} />
            </div>
          </div>
        </div>
      ) : (
        <UserBubble text={sc.question} />
      )}
      {animate ? (
        <div className="kg-aslot">
          {/* DESKTOP — the live graph is the search showcase, so the chat just
              works briefly (Söker → …) then becomes the lead-in message. One
              bubble: content crossfades in place, the thread only ever grows. */}
          <div className="hidden lg:block">
            <div className="kg-ph kg-say grid">
              <div>
                <div className="flex items-start gap-2">
                  <AgentGlyph className="h-6 w-6" />
                  <div className="relative flex-1 rounded-2xl rounded-tl-sm bg-muted/70 px-3 py-2 text-[12.5px] leading-snug">
                    {/* working: searching the graph */}
                    <span className="kg-saywork absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Letar bland era kopplingar
                      <span className="kg-dots inline-flex items-center gap-1">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    {/* composing beat */}
                    <span className="kg-saythink absolute left-3 top-1/2 -translate-y-1/2">
                      <span className="kg-dots inline-flex items-center gap-1">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                    {/* the lead-in message — in flow, so it defines the bubble's
                        height from the start (working states are overlaid) */}
                    <span className="kg-saytext block text-foreground/85">
                      {sc.intro}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* grounded answer — grows in below the message (aligned under it) */}
            <div className="kg-ph kg-reply grid">
              <div>
                <div className="pl-8 pt-2">
                  <div className="relative overflow-hidden rounded-2xl rounded-tl-sm bg-card ring-1 ring-border/60">
                    <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
                    <div className="py-2.5 pl-4 pr-3">
                      <ReplyCardInner sc={sc} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE — no graph here, so the chat shows the agent's tool use: it
              pulls each piece of context out of the graph (rows stream in one by
              one), then grounds the reply. Same retrieval chain the desktop line
              walks — each row stays as the evidence the answer is built on. */}
          <div className="lg:hidden">
            <div className="kg-ph kg-mtrace grid">
              <div>
                <div className="flex items-start gap-2">
                  <AgentGlyph className="h-6 w-6" />
                  <div className="flex-1 overflow-hidden rounded-2xl rounded-tl-sm bg-card ring-1 ring-border/60">
                    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-[12px] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Letar bland era kopplingar
                      <span className="kg-dots ml-auto inline-flex items-center gap-1">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                    <ul className="space-y-1.5 px-3 py-2.5">
                      {sc.chain.map((id, i) => {
                        const node = byId[id]!
                        const Icon = KIND_STYLE[node.kind].icon
                        return (
                          <li
                            key={id}
                            className={cn(
                              'kg-mstep flex items-center gap-2.5',
                              `kg-mstep${i + 1}`
                            )}
                          >
                            {node.kind === 'person' && node.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={node.avatar}
                                alt=""
                                className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-border"
                              />
                            ) : (
                              <span
                                className={cn(
                                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white ring-1',
                                  KIND_STYLE[node.kind].fg,
                                  KIND_STYLE[node.kind].ring
                                )}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                            )}
                            <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                              {TRACE_KIND_LABEL[node.kind]}
                            </span>
                            <span className="truncate text-[12.5px] font-medium text-foreground">
                              {node.label}
                            </span>
                            <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* lead-in message */}
            <div className="kg-ph kg-mmsg grid">
              <div>
                <div className="flex items-start gap-2 pt-2">
                  <AgentGlyph className="h-6 w-6" />
                  <div className="flex-1 rounded-2xl rounded-tl-sm bg-muted/70 px-3 py-2 text-[12.5px] leading-snug text-foreground/85">
                    {sc.intro}
                  </div>
                </div>
              </div>
            </div>
            {/* grounded answer */}
            <div className="kg-ph kg-mcard grid">
              <div>
                <div className="pl-8 pt-2">
                  <div className="relative overflow-hidden rounded-2xl rounded-tl-sm bg-card ring-1 ring-border/60">
                    <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
                    <div className="py-2.5 pl-4 pr-3">
                      <ReplyCardInner sc={sc} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <AgentGlyph className="h-6 w-6" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="rounded-2xl rounded-tl-sm bg-muted/70 px-3 py-2 text-[12.5px] leading-snug text-foreground/85">
              {sc.intro}
            </div>
            <div className="relative overflow-hidden rounded-2xl rounded-tl-sm bg-card ring-1 ring-border/60">
              <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
              <div className="py-2.5 pl-4 pr-3">
                <ReplyCardInner sc={sc} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function KnowledgeGraphSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [started, setStarted] = useState(false)
  // monotonic question counter — the conversation flows continuously (older
  // exchanges persist + scroll off), it never resets
  const [tick, setTick] = useState(0)

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
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setStarted(true), 1100)
    return () => clearTimeout(t)
  }, [inView])

  useEffect(() => {
    if (!started) return
    const iv = setInterval(() => setTick((t) => t + 1), LOOP_MS)
    return () => clearInterval(iv)
  }, [started])

  // sliding window of the most recent exchanges (keeps the DOM bounded while the
  // conversation scrolls continuously)
  const WINDOW = 4
  const scenario = tick % SCENARIOS.length
  const windowStart = Math.max(0, tick - WINDOW + 1)
  const windowTicks: number[] = []
  for (let t = windowStart; t <= tick; t++) windowTicks.push(t)

  const sc = SCENARIOS[scenario]!
  const lawNode = byId[sc.chain[0]!]!

  const fr = fractions(sc.chain)
  const dash = (i: number) => +(1 - fr[i]! / 100).toFixed(3)

  // Per-scenario keyframe: the query line draws from the chat through the agent
  // and along the chain, pausing at each node (halt) so the grounding reads
  // step-by-step, then holds as a faint trace while the answer is shown.
  const dynStyles = `
@keyframes kg-line {
  0%, 39% { stroke-dashoffset: 1; opacity: 0; }
  40%     { opacity: 1; }
  43%     { stroke-dashoffset: ${dash(1)}; }
  45%     { stroke-dashoffset: ${dash(1)}; }
  47%     { stroke-dashoffset: ${dash(2)}; }
  49%     { stroke-dashoffset: ${dash(2)}; }
  51%     { stroke-dashoffset: ${dash(3)}; }
  52%     { stroke-dashoffset: ${dash(3)}; }
  54%     { stroke-dashoffset: ${dash(4)}; }
  55%     { stroke-dashoffset: ${dash(4)}; }
  57%     { stroke-dashoffset: 0; opacity: 1; }
  63%     { stroke-dashoffset: 0; opacity: 1; }
  69%     { stroke-dashoffset: 0; opacity: 0.24; }
  94%     { stroke-dashoffset: 0; opacity: 0.24; }
  97%,100%{ stroke-dashoffset: 0; opacity: 0; }
}`

  return (
    <section
      className="relative overflow-hidden pb-20 pt-10 md:pb-28 md:pt-14"
      style={{ ['--kg-dur' as string]: '13s' }}
    >
      <style>{kgStyles}</style>

      <div className="dark container relative mx-auto px-4 text-foreground">
        {/* Header band */}
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="mx-auto max-w-2xl text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-[2.75rem]"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            En agent som kan{' '}
            <span className="text-foreground/45">er verksamhet utantill.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Så hänger er efterlevnad ihop: regler, krav, styrdokument och
            ansvariga — och hur allt påverkar varandra. Fråga vad som helst —
            agenten följer kopplingarna, svarar grundat i exakt rätt regel och
            förbereder nästa steg. Ni godkänner alltid först.
          </p>
        </div>

        {/* Exchange: chat (left) | graph (right) */}
        <div
          ref={ref}
          className={cn(
            'mx-auto mt-12 grid max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-8',
            inView && 'kg-in'
          )}
        >
          {/* Chat window — sits above the graph's overflow so the query line
              emerges from behind it rather than from a gap to its right */}
          <div className="kg-chat relative z-10 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_-20px_rgba(0,0,0,0.22)]">
            {/* header */}
            <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
              <AgentGlyph className="h-7 w-7" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-none">
                  Laglig-assistent
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Känner hela er efterlevnad
                </p>
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            {/* thread — fixed height, bottom-anchored: the conversation scrolls
                up as the answer card grows in, and the chat never resizes the
                section (no page shift) */}
            <div className="flex h-[420px] flex-col justify-end gap-3 overflow-hidden px-4 py-4">
              {started && (
                <>
                  {/* greeting — shown until it scrolls out of the window */}
                  {windowStart === 0 && (
                    <div key="greet" className="kg-greet flex items-end gap-2">
                      <AgentGlyph className="h-6 w-6" />
                      <div className="max-w-[86%] rounded-2xl rounded-bl-sm bg-muted/70 px-3 py-2 text-[12.5px] leading-snug text-foreground/80">
                        Hej! Jag har koll på alla era krav, styrdokument och
                        ansvariga — fråga mig vad som helst.
                      </div>
                    </div>
                  )}

                  {/* keyframes for the active query line */}
                  <style>{dynStyles}</style>

                  {/* the conversation — recent exchanges persist as full cards
                      and scroll; only the newest builds live */}
                  {windowTicks.map((t) => (
                    <Exchange
                      key={`x-${t}`}
                      sc={SCENARIOS[t % SCENARIOS.length]!}
                      animate={t === tick}
                    />
                  ))}
                </>
              )}
            </div>

            {/* composer */}
            <div className="border-t border-border/70 p-3">
              <div className="flex items-center gap-2 rounded-full border border-border bg-background py-2.5 pl-4 pr-2">
                <span className="min-w-0 flex-1 truncate py-0.5 text-[12.5px] leading-normal text-muted-foreground">
                  Fråga Laglig…
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <ArrowUp className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Graph — desktop showcase only; on mobile the chat shows a
              tool-use trace instead (the graph doesn't fit a phone column) */}
          <div className="relative hidden w-full lg:block">
            <div className="relative aspect-[1000/760] w-full overflow-visible">
              {/* Edges (static) + query line (re-keyed per scenario) */}
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden
              >
                <defs>
                  {/* tapered edges: bright near the agent, fading out to the rim */}
                  <radialGradient
                    id="kg-edge-grad"
                    cx="420"
                    cy="380"
                    r="640"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop
                      offset="0%"
                      style={{
                        stopColor: 'hsl(var(--foreground))',
                        stopOpacity: 0.3,
                      }}
                    />
                    <stop
                      offset="55%"
                      style={{
                        stopColor: 'hsl(var(--foreground))',
                        stopOpacity: 0.18,
                      }}
                    />
                    <stop
                      offset="100%"
                      style={{
                        stopColor: 'hsl(var(--foreground))',
                        stopOpacity: 0.1,
                      }}
                    />
                  </radialGradient>
                </defs>

                {/* tendrils — the agent reaches out into the large background
                    web, so the labeled graph is plugged into the bigger graph */}
                <g className="kg-bg" stroke="white" fill="white" aria-hidden>
                  {AGENT_TENDRILS.map(([x, y], i) => (
                    <g key={i}>
                      <line
                        x1={byId['agent']!.x}
                        y1={byId['agent']!.y}
                        x2={x}
                        y2={y}
                        strokeOpacity="0.07"
                        strokeWidth="1"
                      />
                      <circle cx={x} cy={y} r="3" fillOpacity="0.11" />
                    </g>
                  ))}
                </g>

                {EDGES.map(([a, b]) => (
                  <path
                    key={`${a}-${b}`}
                    d={curve(byId[a]!, byId[b]!, 0)}
                    pathLength={1}
                    className="kg-edge"
                  />
                ))}

                {started && (
                  <path
                    key={tick}
                    d={cometPath(sc.chain, 1, 0)}
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
                      ['--d' as string]: `${0.25 + n.step * 0.22}s`,
                    }}
                  >
                    <div className={`kg-float kg-float-${n.drift}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        {isAgent ? (
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-lg ring-4 ring-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/logo-icon-white.png"
                              alt="Laglig"
                              className="h-6 w-auto"
                            />
                            <span className="kg-corepulse absolute inset-0 rounded-2xl ring-2 ring-white/30" />
                          </div>
                        ) : isPerson ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={n.avatar}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover shadow-md ring-2 ring-white/20"
                          />
                        ) : (
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-[0_4px_14px_-2px_rgba(0,0,0,0.5)] ring-1',
                              s.fg,
                              s.ring
                            )}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </div>
                        )}
                        {!isAgent && (
                          <span className="whitespace-nowrap text-[11px] font-medium text-white/85 [text-shadow:_0_1px_5px_rgb(0_0_0_/_0.95)]">
                            {n.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Per-question graph layer (re-keyed → animations replay) */}
              {started && (
                <div key={tick}>
                  {/* Stop glows — bloom as the comet lands on each chain node */}
                  {sc.chain.map((id, i) => (
                    <span
                      key={id}
                      className={cn(
                        'kg-glow absolute z-[9] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full',
                        `kg-s${i + 1}`
                      )}
                      style={posStyle(id)}
                      aria-hidden
                    />
                  ))}

                  {/* Reasoning halts — transient "thinking" pills, placed on the
                      node's outer side (above upper-arm nodes, below lower) */}
                  {[sc.chain[1]!, sc.chain[2]!, sc.chain[3]!].map((id, i) => (
                    <span
                      key={id}
                      className={cn(
                        'kg-pill absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-amber-300/60 bg-card px-2 py-0.5 text-[10.5px] font-medium text-amber-700 shadow-sm dark:bg-amber-500/10 dark:text-amber-300',
                        `kg-p${i + 1}`
                      )}
                      style={{
                        left: posStyle(id).left,
                        top:
                          byId[id]!.y < 300
                            ? `calc(${posStyle(id).top} - 44px)`
                            : `calc(${posStyle(id).top} + 44px)`,
                      }}
                    >
                      {sc.reasoning[i]}
                    </span>
                  ))}

                  {/* Source citation — pops at the law node as the comet arrives,
                      anchored to the law's outer side toward the open left */}
                  <div
                    className="kg-src absolute z-20 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300/70 bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 shadow-sm"
                    style={{
                      right: pct(VB_W - lawNode.x, VB_W),
                      top:
                        lawNode.y < 300
                          ? `calc(${posStyle(sc.chain[0]!).top} - 48px)`
                          : `calc(${posStyle(sc.chain[0]!).top} + 32px)`,
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                    {sc.source}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Capabilities — the agent doesn't just answer, it acts across the
            whole system (autonomously, on approval). */}
        <div className="mx-auto mt-16 max-w-3xl text-center md:mt-24">
          <p className="mb-3 font-safiro text-[13px] font-medium text-foreground/60">
            Och den agerar — inte bara svarar
          </p>
          <h3
            className="text-2xl font-medium tracking-tight md:text-3xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Föreslår, förbereder och utför — autonomt när ni vill.
          </h3>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            {[
              { icon: ListChecks, label: 'Skapar uppgifter' },
              { icon: FileText, label: 'Skriver utkast till styrdokument' },
              { icon: PencilLine, label: 'Granskar & uppdaterar policyer' },
              { icon: RefreshCw, label: 'Uppdaterar status & kravpunkter' },
              { icon: Paperclip, label: 'Kopplar bevis till rätt krav' },
              {
                icon: ShieldCheck,
                label: 'Sammanställer underlag till revisorn',
              },
            ].map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.06] px-3.5 py-2 text-[13px] text-foreground/85"
              >
                <c.icon className="h-4 w-4 text-amber-400" />
                {c.label}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-7 max-w-xl text-sm text-foreground/55">
            Allt loggas och är spårbart — och ni godkänner alltid innan något
            genomförs.
          </p>
        </div>
      </div>
    </section>
  )
}

const kgStyles = `
/* static structure — straight tapered spokes (bright at the agent, fading to
   the rim via the kg-edge-grad radial gradient); draw in once on scroll. */
.kg-edge {
  stroke: url(#kg-edge-grad);
  stroke-width: 1.35;
  fill: none;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.kg-in .kg-edge { animation: kg-draw 1.5s ease forwards; }
@keyframes kg-draw { to { stroke-dashoffset: 0; } }

.kg-queryline {
  stroke: hsl(38 92% 50%);
  stroke-width: 2.5; fill: none; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0;
  filter: drop-shadow(0 0 5px hsl(38 92% 50% / 0.6));
  animation: kg-line var(--kg-dur, 12s) linear forwards;
}

@keyframes kg-fade { to { opacity: 1; } }

.kg-bg { opacity: 0; }
.kg-in .kg-bg { animation: kg-fade 2.4s ease 0.5s forwards; }

.kg-node { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
.kg-in .kg-node { animation: kg-pop 0.95s cubic-bezier(0.2,1,0.3,1) forwards; animation-delay: var(--d); }
@keyframes kg-pop { to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

.kg-float { animation: kg-float 7s ease-in-out infinite; }
.kg-float-1 { animation-duration: 6.5s; animation-delay: -1s; }
.kg-float-2 { animation-duration: 8s; animation-delay: -3s; }
.kg-float-3 { animation-duration: 7.5s; animation-delay: -5s; }
@keyframes kg-float { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0,-5px); } }

.kg-corepulse { animation: kg-ring 3.5s ease-in-out infinite; }
@keyframes kg-ring { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0; transform: scale(1.25); } }

/* stop glows: a soft amber halo blooming as the line reaches each node */
.kg-glow {
  background: radial-gradient(closest-side, hsl(38 92% 50% / 0.55), transparent);
  opacity: 0; transform: translate(-50%, -50%) scale(0.5);
}
.kg-s1 { animation: kg-stop1 var(--kg-dur, 12s) ease forwards; }
.kg-s2 { animation: kg-stop2 var(--kg-dur, 12s) ease forwards; }
.kg-s3 { animation: kg-stop3 var(--kg-dur, 12s) ease forwards; }
.kg-s4 { animation: kg-stop4 var(--kg-dur, 12s) ease forwards; }
@keyframes kg-stop1 {
  0%,45%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  48%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  52%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  91%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  97%,100% { opacity: 0; }
}
@keyframes kg-stop2 {
  0%,49%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  52%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  56%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  91%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  97%,100% { opacity: 0; }
}
@keyframes kg-stop3 {
  0%,52%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  55%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  59%      { opacity: 0.5; transform: translate(-50%,-50%) scale(0.95); }
  91%      { opacity: 0.4; transform: translate(-50%,-50%) scale(0.95); }
  97%,100% { opacity: 0; }
}
@keyframes kg-stop4 {
  0%,55%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
  58%      { opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
  62%      { opacity: 0.55; transform: translate(-50%,-50%) scale(0.98); }
  91%      { opacity: 0.45; transform: translate(-50%,-50%) scale(0.98); }
  97%,100% { opacity: 0; }
}

/* reasoning halts — blink in at each node, then clear before the reply lands */
.kg-pill { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
.kg-p1 { animation: kg-pill1 var(--kg-dur, 12s) ease forwards; }
.kg-p2 { animation: kg-pill2 var(--kg-dur, 12s) ease forwards; }
.kg-p3 { animation: kg-pill3 var(--kg-dur, 12s) ease forwards; }
@keyframes kg-pill1 {
  0%,51%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  53%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  61%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  65%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}
@keyframes kg-pill2 {
  0%,54%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  56%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  63%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  67%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}
@keyframes kg-pill3 {
  0%,57%   { opacity: 0; transform: translate(-50%,-50%) scale(0.85); }
  59%      { opacity: 1; transform: translate(-50%,-50%) scale(1); }
  64%      { opacity: 0.9; transform: translate(-50%,-50%) scale(1); }
  68%,100% { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
}

/* the source is the law-node "step" — it blinks in as the line reaches the law
   and clears as the line moves on, exactly like the other reasoning halts (the
   chat reply keeps the source persistently) */
.kg-src { opacity: 0; animation: kg-srcchip var(--kg-dur, 12s) ease forwards; }
@keyframes kg-srcchip {
  0%,45%   { opacity: 0; }
  48%      { opacity: 1; }
  58%      { opacity: 1; }
  62%,100% { opacity: 0; }
}

/* thinking-shimmer dots (in the assistant loading label) */
.kg-dots i {
  display: inline-block; width: 5px; height: 5px; border-radius: 9999px;
  background: hsl(var(--muted-foreground)); animation: kg-bounce 1.1s ease-in-out infinite;
}
.kg-dots i:nth-child(2) { animation-delay: 0.15s; }
.kg-dots i:nth-child(3) { animation-delay: 0.3s; }
/* light dots — for the dark (primary) user "typing" bubble */
.kg-dots-light i { background: hsl(var(--primary-foreground)); }
@keyframes kg-bounce {
  0%,80%,100% { transform: translateY(0); opacity: 0.4; }
  40%         { transform: translateY(-3px); opacity: 1; }
}

/* greeting + accumulated (already-answered) messages fade in once on mount */
.kg-greet, .kg-msg-in { animation: kg-msgin 0.45s ease both; }
@keyframes kg-msgin {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* assistant phases — search → think → reply. Each is a grid-rows (0fr⇄1fr)
   expand/collapse, so height changes are buttery and the thread scrolls up
   smoothly (no hard height jump, no fixed px to clip a tall reply). The
   transitions overlap slightly so there's never a 0-height flash between beats. */
.kg-ph { display: grid; grid-template-rows: 0fr; opacity: 0; }
.kg-ph > div { min-height: 0; overflow: hidden; }

/* user side: the asker "typing" (~3s) → the question lands */
.kg-utyping { animation: kg-ph-utyping var(--kg-dur, 13s) ease forwards; }
@keyframes kg-ph-utyping {
  0%        { grid-template-rows: 0fr; opacity: 0; }
  1%        { grid-template-rows: 1fr; opacity: 1; }
  22%       { grid-template-rows: 1fr; opacity: 1; }
  25%, 100% { grid-template-rows: 0fr; opacity: 0; }
}
.kg-uquestion { animation: kg-ph-uquestion var(--kg-dur, 13s) ease forwards; }
@keyframes kg-ph-uquestion {
  0%, 21% { grid-template-rows: 0fr; opacity: 0; }
  25%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}

/* the assistant bubble appears only AFTER the user's question lands (~25%),
   then holds — its content (working → think → message) crossfades in place, so
   it never collapses */
.kg-say { animation: kg-ph-say var(--kg-dur, 13s) ease forwards; }
@keyframes kg-ph-say {
  0%, 29% { grid-template-rows: 0fr; opacity: 0; }
  33%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}
.kg-saywork { animation: kg-saywork var(--kg-dur, 13s) ease forwards; }
@keyframes kg-saywork {
  0%, 30%  { opacity: 0; }
  33%      { opacity: 1; }
  55%      { opacity: 1; }
  59%, 100%{ opacity: 0; }
}
.kg-saythink { opacity: 0; animation: kg-saythink var(--kg-dur, 13s) ease forwards; }
@keyframes kg-saythink {
  0%, 56%  { opacity: 0; }
  60%      { opacity: 1; }
  64%      { opacity: 1; }
  68%, 100%{ opacity: 0; }
}
.kg-saytext { opacity: 0; animation: kg-saytext var(--kg-dur, 13s) ease forwards; }
@keyframes kg-saytext {
  0%, 67% { opacity: 0; }
  71%     { opacity: 1; }
  100%    { opacity: 1; }
}
/* grounded answer card — grows in below the message, then holds */
.kg-reply { animation: kg-ph-reply var(--kg-dur, 13s) ease forwards; }
@keyframes kg-ph-reply {
  0%, 73% { grid-template-rows: 0fr; opacity: 0; }
  78%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}

/* MOBILE tool-use trace — the graph is hidden on small screens, so the agent's
   retrieval is shown in-chat: the trace card opens when the search starts, its
   rows (the graph nodes it pulls) stream in one by one, then the lead-in message
   and grounded card grow in below. The thread only ever grows (no wobble). */
.kg-mtrace { animation: kg-mtrace var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mtrace {
  0%, 30% { grid-template-rows: 0fr; opacity: 0; }
  34%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}
.kg-mstep { opacity: 0; transform: translateY(4px); }
.kg-mstep1 { animation: kg-mstep1 var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mstep1 {
  0%, 34% { opacity: 0; transform: translateY(4px); }
  38%     { opacity: 1; transform: none; }
  100%    { opacity: 1; transform: none; }
}
.kg-mstep2 { animation: kg-mstep2 var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mstep2 {
  0%, 41% { opacity: 0; transform: translateY(4px); }
  45%     { opacity: 1; transform: none; }
  100%    { opacity: 1; transform: none; }
}
.kg-mstep3 { animation: kg-mstep3 var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mstep3 {
  0%, 48% { opacity: 0; transform: translateY(4px); }
  52%     { opacity: 1; transform: none; }
  100%    { opacity: 1; transform: none; }
}
.kg-mstep4 { animation: kg-mstep4 var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mstep4 {
  0%, 55% { opacity: 0; transform: translateY(4px); }
  59%     { opacity: 1; transform: none; }
  100%    { opacity: 1; transform: none; }
}
.kg-mmsg { animation: kg-mmsg var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mmsg {
  0%, 63% { grid-template-rows: 0fr; opacity: 0; }
  67%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}
.kg-mcard { animation: kg-mcard var(--kg-dur, 13s) ease forwards; }
@keyframes kg-mcard {
  0%, 72% { grid-template-rows: 0fr; opacity: 0; }
  77%     { grid-template-rows: 1fr; opacity: 1; }
  100%    { grid-template-rows: 1fr; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .kg-edge, .kg-queryline, .kg-node {
    animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important;
    transform: translate(-50%, -50%) scale(1) !important;
  }
  .kg-corepulse, .kg-float, .kg-glow, .kg-dots i { animation: none !important; }
  .kg-bg { opacity: 1 !important; animation: none !important; }
  .kg-utyping, .kg-saywork, .kg-saythink { display: none !important; }
  .kg-saytext { opacity: 1 !important; }
  .kg-mstep { opacity: 1 !important; transform: none !important; }
  .kg-ph { animation: none !important; opacity: 1 !important; }
  .kg-uquestion, .kg-say, .kg-reply,
  .kg-mtrace, .kg-mmsg, .kg-mcard { grid-template-rows: 1fr !important; }
  .kg-uquestion > div, .kg-say > div, .kg-reply > div,
  .kg-mtrace > div, .kg-mmsg > div, .kg-mcard > div { overflow: visible !important; }
  .kg-glow { opacity: 0.45 !important; transform: translate(-50%,-50%) scale(1) !important; }
  .kg-pill { animation: none !important; opacity: 0.85 !important; transform: translate(-50%,-50%) scale(1) !important; }
  .kg-greet, .kg-msg-in, .kg-src {
    animation: none !important; opacity: 1 !important; transform: none !important;
  }
}
`

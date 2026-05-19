import { cn } from '@/lib/utils'

// Prototype variant of WhySection — editorial layout with a single rising
// sparkline. Big Safiro numbers carry the narrative on the left, a precise
// monochrome chart on the right tells the same story visually. One warm
// accent (amber) lands only on the destination — the 50+ employee tier — so
// the eye is pulled to "this is where you're heading."
//
// Aesthetic reference: Anthropic product pages, Apple pricing, Vercel
// analytics hero. Restraint over decoration.

const tiers = [
  {
    label: 'Enskild firma',
    people: '1 person',
    total: 3,
    newAreas: ['Bokföring', 'Skatt', 'Avtal'],
  },
  {
    label: 'Litet AB',
    people: '2–10 anställda',
    total: 6,
    newAreas: ['Arbetsmiljö', 'Arbetsrätt', 'Försäkringar'],
  },
  {
    label: 'Växande bolag',
    people: '11–49 anställda',
    total: 9,
    newAreas: ['Systematiskt arbetsmiljöarbete', 'Dataskydd', 'Kollektivavtal'],
  },
  {
    label: 'Etablerat bolag',
    people: '50+ anställda',
    total: 12,
    newAreas: [
      'Aktiva åtgärder mot diskriminering',
      'Visselblåsarfunktion',
      'Hållbarhetsrapportering',
    ],
  },
] as const

// SVG chart layout — sized once, scales fluidly via viewBox.
const W = 640
const H = 320
const PAD = { left: 56, right: 36, top: 56, bottom: 82 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const yMax = 14 // headroom above the 12+ datapoint

const xPos = (i: number) => PAD.left + (i / (tiers.length - 1)) * innerW
const yPos = (v: number) => PAD.top + (1 - v / yMax) * innerH

const points = tiers.map((t, i) => ({ x: xPos(i), y: yPos(t.total) }))

// Smooth monotone cubic through the 4 datapoints — control points are pulled
// horizontally toward each neighbour so the curve eases into each dot instead
// of overshooting.
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const curr = pts[i]!
    const cp1x = prev.x + (curr.x - prev.x) * 0.5
    const cp2x = curr.x - (curr.x - prev.x) * 0.5
    d += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

const linePath = buildSmoothPath(points)
const lastPt = points[points.length - 1]!
const firstPt = points[0]!
const areaPath = `${linePath} L ${lastPt.x} ${yPos(0)} L ${firstPt.x} ${yPos(0)} Z`

export function WhySectionGraph() {
  return (
    <section className="relative overflow-hidden border-y bg-section-warm py-12 md:py-20">
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Compliance vid skala
          </p>

          <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12 lg:gap-20">
            {/* LEFT — editorial copy block */}
            <div className="lg:col-span-5">
              <h2
                className="mb-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-[3rem]"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Ni har koll på bokföringen.
                <br />
                <span className="text-foreground/40">
                  Vem har koll på lagarna?
                </span>
              </h2>

              <p className="mb-10 max-w-md text-base leading-relaxed text-muted-foreground">
                Varje företag har skyldigheter enligt lag — från enskild firma
                till koncern. Det som skiljer är hur många, inte om.
              </p>

              <div className="space-y-6">
                <BigNumber
                  value="3"
                  caption="regelområden"
                  meta="som enskild firma"
                />
                <BigNumber
                  value="12+"
                  caption="regelområden"
                  meta="vid 50+ anställda"
                  accent
                />
              </div>

              <p className="mt-10 max-w-md text-base leading-relaxed text-foreground/85">
                Listan växer med företaget — och blir aldrig kortare.
                <span className="mt-1 block text-muted-foreground">
                  Någon måste hålla koll på vilka som gäller just er.
                </span>
              </p>
            </div>

            {/* RIGHT — sparkline */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl border bg-card/50 p-3 shadow-[0_1px_0_0_rgb(0_0_0_/_0.02),0_12px_32px_-16px_rgb(0_0_0_/_0.10)] backdrop-blur-sm md:p-5">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="h-auto w-full text-foreground"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id="why-area" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="currentColor"
                        stopOpacity="0.14"
                      />
                      <stop
                        offset="100%"
                        stopColor="currentColor"
                        stopOpacity="0"
                      />
                    </linearGradient>
                    {/* Warm accent overlay — fades in only across the right
                        third so the destination feels charged */}
                    <linearGradient
                      id="why-area-warm"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop
                        offset="55%"
                        stopColor="rgb(180 83 9)"
                        stopOpacity="0"
                      />
                      <stop
                        offset="100%"
                        stopColor="rgb(180 83 9)"
                        stopOpacity="0.16"
                      />
                    </linearGradient>
                  </defs>

                  {/* Y-axis ticks — minimal, two reference levels */}
                  {[6, 12].map((v) => (
                    <g key={v}>
                      <line
                        x1={PAD.left}
                        y1={yPos(v)}
                        x2={W - PAD.right}
                        y2={yPos(v)}
                        stroke="currentColor"
                        strokeOpacity="0.07"
                        strokeDasharray="2 5"
                      />
                      <text
                        x={PAD.left - 14}
                        y={yPos(v) + 3}
                        textAnchor="end"
                        className="fill-muted-foreground text-[10px]"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        {v}
                      </text>
                    </g>
                  ))}

                  {/* Area fills — mono base + warm right-side overlay */}
                  <path d={areaPath} fill="url(#why-area)" />
                  <path d={areaPath} fill="url(#why-area-warm)" />

                  {/* Curve */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* X-axis baseline */}
                  <line
                    x1={PAD.left}
                    y1={yPos(0)}
                    x2={W - PAD.right}
                    y2={yPos(0)}
                    stroke="currentColor"
                    strokeOpacity="0.15"
                  />

                  {/* Tier dots — last one in warm accent */}
                  {tiers.map((t, i) => {
                    const last = i === tiers.length - 1
                    const x = xPos(i)
                    const y = yPos(t.total)
                    return (
                      <g key={t.label}>
                        <circle
                          cx={x}
                          cy={y}
                          r={last ? 16 : 11}
                          fill={last ? 'rgb(245 158 11)' : 'currentColor'}
                          fillOpacity={last ? 0.16 : 0.06}
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={last ? 6 : 4.5}
                          fill={last ? 'rgb(180 83 9)' : 'currentColor'}
                        />
                        <text
                          x={x}
                          y={y - 22}
                          textAnchor="middle"
                          className={cn(
                            'text-[13px] font-medium',
                            last ? 'fill-amber-900' : 'fill-foreground'
                          )}
                          style={{
                            fontFamily: "'Safiro', system-ui, sans-serif",
                          }}
                        >
                          {t.total}+
                        </text>
                      </g>
                    )
                  })}

                  {/* X-axis tier labels */}
                  {tiers.map((t, i) => (
                    <g key={`x-${t.label}`}>
                      <text
                        x={xPos(i)}
                        y={yPos(0) + 22}
                        textAnchor="middle"
                        className="fill-foreground text-[11px] font-medium"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        {t.label}
                      </text>
                      <text
                        x={xPos(i)}
                        y={yPos(0) + 40}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                      >
                        {t.people}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Category footnotes — list of categories under each tier,
                    each prefixed with "+" so the "added at this tier" framing
                    is carried by the items themselves rather than a header.
                    Last column gets the warm accent so the destination story
                    carries through. */}
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-foreground/5 pt-4 text-[11px] leading-snug md:grid-cols-4">
                  {tiers.map((t, i) => {
                    const last = i === tiers.length - 1
                    return (
                      <ul
                        key={`foot-${t.label}`}
                        className={cn(
                          'space-y-1 px-1',
                          last ? 'text-amber-950' : 'text-foreground/75'
                        )}
                      >
                        {t.newAreas.map((area) => (
                          <li key={area} className="flex gap-1.5 leading-snug">
                            <span
                              className={cn(
                                'select-none',
                                last
                                  ? 'text-amber-700/80'
                                  : 'text-muted-foreground/60'
                              )}
                            >
                              +
                            </span>
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bridge into the rest of the page */}
        <div className="mx-auto mt-20 max-w-2xl text-center md:mt-24">
          <p className="text-xl font-medium md:text-2xl">
            Det svåra är inte att följa lagen.
            <br />
            Det svåra är att veta vilka lagar som gäller just er.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Och &quot;vi visste inte&quot; är sällan ett bra svar – vare sig för
            en myndighet eller en kund som frågar. Det är där Laglig.se börjar.
          </p>
        </div>
      </div>
    </section>
  )
}

function BigNumber({
  value,
  caption,
  meta,
  accent,
}: {
  value: string
  caption: string
  meta: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline gap-4">
      <span
        className={cn(
          'text-6xl font-medium leading-none tracking-tight md:text-7xl',
          accent ? 'text-amber-900' : 'text-foreground'
        )}
        style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
      >
        {value}
      </span>
      <div>
        <p className="text-sm font-medium">{caption}</p>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Mail,
  FolderClosed,
  AlertTriangle,
  Landmark,
  Gavel,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// WhySection — "where does your compliance live today?" Efterlevnad is a whole
// job that today is scattered across a spreadsheet, an inbox, a binder and
// someone's head — no overview, no record. Sets up #3 directly: scattered →
// samlad, no record → spårbar. Each tile mimics its real artifact; the pile
// reveals with a staggered drop-in. Near-monochrome warm cream, one amber
// accent on the human single-point-of-failure.

// ── reveal-on-scroll wrapper for one tile ──────────────────────────────────
function Tile({
  pos,
  z,
  rotate,
  i,
  shown,
  children,
}: {
  pos: string
  z: string
  rotate: number
  i: number
  shown: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('absolute transition-all duration-500 ease-out', pos, z)}
      style={{
        transitionDelay: `${i * 70}ms`,
        transform: shown ? 'translateY(0)' : 'translateY(16px)',
        opacity: shown ? 1 : 0,
      }}
    >
      <div style={{ transform: `rotate(${rotate}deg)` }}>{children}</div>
    </div>
  )
}

const CARD =
  'rounded-xl border border-border/70 bg-card shadow-[0_6px_20px_-8px_rgb(0_0_0_/_0.22)]'

export function WhySectionGraph() {
  const pileRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = pileRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="relative overflow-hidden border-y bg-section-warm py-16 md:py-24">
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[12.5px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Compliance idag
          </p>

          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* LEFT — editorial copy block */}
            <div className="lg:col-span-5">
              <h2
                className="mb-6 text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-[3rem]"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                Ni har koll på bokföringen.
                <br />
                <span className="text-foreground/40">
                  Vem har koll på er compliance?
                </span>
              </h2>

              <p className="mb-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Efterlevnad är inte en uppgift. Det är att veta vilka regler som
                gäller, leva upp till dem, hålla koll när de ändras — och kunna
                visa det. Hela tiden.
              </p>

              <p className="max-w-md text-lg leading-relaxed text-foreground/85">
                Idag är allt det utspritt: ett kalkylark här, en mejltråd där,
                en pärm i hyllan — och det mesta i någons huvud.
                <span className="mt-3 block text-muted-foreground">
                  Ingen överblick. Inget facit när en myndighet, en kund eller
                  en revisor frågar “hur vet ni det?”
                </span>
              </p>
            </div>

            {/* RIGHT — where compliance lives today (scattered pile) */}
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-b from-card/30 to-section-warm/0 p-5 shadow-[0_1px_0_0_rgb(0_0_0_/_0.02),0_12px_32px_-16px_rgb(0_0_0_/_0.10)] backdrop-blur-sm md:p-7">
                <div
                  ref={pileRef}
                  className="relative min-h-[480px] md:min-h-[620px]"
                >
                  {/* faint dotted backdrop so the pile sits on texture, not void */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px)',
                      backgroundSize: '22px 22px',
                      maskImage:
                        'radial-gradient(80% 80% at 50% 45%, black, transparent 100%)',
                      WebkitMaskImage:
                        'radial-gradient(80% 80% at 50% 45%, black, transparent 100%)',
                    }}
                  />

                  {/* 1 — spreadsheet */}
                  <Tile
                    pos="left-[3%] top-[4%]"
                    z="z-10"
                    rotate={-3}
                    i={0}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'w-[229px] overflow-hidden')}>
                      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-600/10 text-[10px] font-bold text-emerald-700">
                          XLS
                        </span>
                        <p className="truncate text-[14px] font-medium">
                          Efterlevnad_FINAL_v3
                        </p>
                      </div>
                      {/* mini sheet — header row + rows of data */}
                      <div className="border-t border-border/60">
                        {Array.from({ length: 5 }).map((_, r) => (
                          <div
                            key={r}
                            className="grid grid-cols-4 border-b border-border/40 last:border-b-0"
                          >
                            {Array.from({ length: 4 }).map((_, c) => (
                              <div
                                key={c}
                                className={cn(
                                  'flex h-[18px] items-center border-r border-border/40 px-1.5 last:border-r-0',
                                  r === 0 && 'bg-muted/50'
                                )}
                              >
                                <span
                                  className={cn(
                                    'h-1.5 rounded-full',
                                    r === 0
                                      ? 'bg-foreground/25'
                                      : 'bg-foreground/10',
                                    c === 0
                                      ? 'w-3/4'
                                      : c === 3
                                        ? 'w-1/3'
                                        : 'w-1/2'
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <p className="px-3 py-1.5 text-[11.5px] text-muted-foreground">
                        senast rörd för 8 mån sedan
                      </p>
                    </div>
                  </Tile>

                  {/* 2 — unread email */}
                  <Tile
                    pos="right-[4%] top-[2%]"
                    z="z-10"
                    rotate={3}
                    i={1}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'w-[242px] px-4 py-3.5')}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-[18px] w-[18px] text-muted-foreground" />
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                          Oläst
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[14px] font-medium">
                        Sv: Re: Re: nya AFS-kraven?
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                        ”Hej, vet någon om det här gäller oss…”
                      </p>
                    </div>
                  </Tile>

                  {/* 8 — official myndighet letter (the universally dreaded one) */}
                  <Tile
                    pos="left-[33%] bottom-[7%]"
                    z="z-20"
                    rotate={-2}
                    i={7}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'w-[204px] overflow-hidden')}>
                      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/60">
                          Arbetsmiljöverket
                        </span>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[14px] font-medium">
                          Inspektionsmeddelande
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          oöppnat · svar krävs inom 14 dagar
                        </p>
                      </div>
                    </div>
                  </Tile>

                  {/* 3 — binder */}
                  <Tile
                    pos="left-[5%] top-[42%]"
                    z="z-10"
                    rotate={-2}
                    i={2}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'flex w-[201px] overflow-hidden')}>
                      <div className="w-2 shrink-0 bg-foreground/70" />
                      <div className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <FolderClosed className="h-4 w-4 text-muted-foreground" />
                          <p className="text-[14px] font-medium">
                            Rutiner & policyer
                          </p>
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          pärm i hyllan · 2022
                        </p>
                      </div>
                    </div>
                  </Tile>

                  {/* 4 — Anna (single point of failure) — focal, on top */}
                  <Tile
                    pos="left-[37%] top-[18%]"
                    z="z-30"
                    rotate={1}
                    i={3}
                    shown={shown}
                  >
                    <div
                      className={cn(
                        'w-[222px] rounded-xl border border-amber-400/50 bg-card px-4 py-3.5 shadow-[0_12px_30px_-10px_rgb(180_83_9_/_0.35)] ring-1 ring-amber-400/30'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/demo-team/anna.webp"
                          alt=""
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-amber-400/40"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">”Anna vet”</p>
                          <p className="text-[12.5px] text-muted-foreground">
                            Compliance-ansvarig (inofficiellt)
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-amber-400/10 px-2 py-1 text-[12.5px] font-medium text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        …men Anna slutar i juni
                      </div>
                    </div>
                  </Tile>

                  {/* 5 — stale PDF */}
                  <Tile
                    pos="right-[3%] top-[45%]"
                    z="z-20"
                    rotate={4}
                    i={4}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'relative w-[227px] px-4 py-3.5')}>
                      {/* folded corner */}
                      <div className="absolute right-0 top-0 h-0 w-0 border-l-[14px] border-t-[14px] border-l-transparent border-t-muted-foreground/15" />
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded bg-rose-600/10 text-[10px] font-bold text-rose-700">
                          PDF
                        </span>
                        <p className="truncate text-[14px] font-medium">
                          Compliance-genomgång
                        </p>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="h-1 w-full rounded bg-muted/60" />
                        <div className="h-1 w-4/5 rounded bg-muted/60" />
                      </div>
                      <p className="mt-2 text-[11.5px] text-muted-foreground">
                        konsultrapport · 1,5 år gammal
                      </p>
                    </div>
                  </Tile>

                  {/* 6 — post-it */}
                  <Tile
                    pos="left-[4%] bottom-[4%]"
                    z="z-20"
                    rotate={6}
                    i={5}
                    shown={shown}
                  >
                    <div className="flex aspect-square w-[188px] flex-col justify-between rounded-sm bg-amber-100/85 p-4 shadow-[0_12px_26px_-10px_rgb(0_0_0_/_0.3)]">
                      <p
                        className="text-[19px] leading-snug text-amber-950"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        Förnya tillståndet!
                      </p>
                      <p className="text-[11px] text-amber-900/55">
                        post-it på skärmen
                      </p>
                    </div>
                  </Tile>

                  {/* 7 — shared folder, version conflict */}
                  <Tile
                    pos="right-[3%] bottom-[4%]"
                    z="z-10"
                    rotate={-3}
                    i={6}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'relative w-[207px] px-4 py-3.5')}>
                      {/* stacked-file hint behind */}
                      <div className="absolute -right-1.5 -top-1.5 h-full w-full rounded-xl border border-border/50 bg-card/60" />
                      <div className="relative flex items-center gap-1.5">
                        <FolderClosed className="h-4 w-4 text-muted-foreground" />
                        <p className="truncate text-[14px] font-medium">
                          /Gemensam/HMS
                        </p>
                      </div>
                      <p className="relative mt-0.5 text-[11.5px] text-muted-foreground">
                        vem har senaste versionen?
                      </p>
                    </div>
                  </Tile>

                  {/* 9 — vite / sanktionsavgift (the stakes) */}
                  <Tile
                    pos="left-[35%] top-[49%]"
                    z="z-20"
                    rotate={1}
                    i={8}
                    shown={shown}
                  >
                    <div className={cn(CARD, 'w-[172px] px-4 py-3.5')}>
                      <div className="flex items-center gap-2">
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/60">
                          Sanktionsavgift
                        </span>
                      </div>
                      <p
                        className="mt-1.5 text-[20px] font-semibold leading-none text-rose-700"
                        style={{
                          fontFamily: "'Safiro', system-ui, sans-serif",
                        }}
                      >
                        40 000 kr
                      </p>
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                        för utebliven riskbedömning
                      </p>
                    </div>
                  </Tile>
                </div>

                {/* grounding caption */}
                <div className="relative mt-3 flex items-center justify-between border-t border-foreground/5 pt-4 text-[12px]">
                  <span className="text-muted-foreground">
                    Nio ställen — och ingen som har hela bilden.
                  </span>
                  <span className="font-medium text-amber-900">
                    Noll överblick
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bridge into the showcase — "hålla ihop allt" → samlad, "visa det" →
            spårbar, "systemet för resten" → #3 */}
        <div className="mx-auto mt-16 max-w-2xl text-center md:mt-20">
          <p className="text-2xl font-medium md:text-3xl">
            Det svåra är inte att följa reglerna.
            <br />
            Det svåra är att hålla ihop allt de kräver — och kunna visa det.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            Er bokföring har ett system. Det här är systemet för resten.
          </p>
        </div>
      </div>
    </section>
  )
}

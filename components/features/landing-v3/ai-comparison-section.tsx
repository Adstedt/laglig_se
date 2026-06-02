import {
  Scale,
  ListChecks,
  FileText,
  ClipboardCheck,
  Users,
  RefreshCw,
  BookOpen,
  Globe,
  Check,
  Minus,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * AI comparison module — the dark "claim" section that sets up the knowledge
 * graph that follows. Three tiers of AI, framed by how much of *your* world is
 * in the context:
 *   1. Vanlig AI      — general knowledge, guesses
 *   2. Juridisk AI    — knows the law, but not you
 *   3. Laglig         — the law + your full operating picture (the graph)
 * The growing stack of "context" chips is the punchline; the graph section
 * underneath then *demonstrates* that whole picture in motion.
 *
 * Rendered on the dark `bg-foreground` shell (matches the agent aesthetic) so
 * the claim lands hard before the cream graph proves it.
 */

type Chip = { icon: typeof Scale; label: string }

type Column = {
  name: string
  desc: string
  context: Chip[]
  /** context the tier lacks — shown as dimmed "ghost" rows */
  missing?: Chip[]
  verdict: string
  hero?: boolean
}

const COLUMNS: Column[] = [
  {
    name: 'Vanlig AI',
    desc: 'Allmän chattbot',
    context: [{ icon: Globe, label: 'Allmän kunskap' }],
    missing: [
      { icon: Scale, label: 'Sveriges lagar' },
      { icon: ListChecks, label: 'Er laglista & krav' },
      { icon: FileText, label: 'Era styrdokument' },
      { icon: ClipboardCheck, label: 'Era uppgifter & status' },
      { icon: Users, label: 'Ansvariga' },
    ],
    verdict: 'Gissar utifrån allmän kunskap — ingen koll på lagen eller er.',
  },
  {
    name: 'Juridisk AI',
    desc: 'Tränad på lagtext',
    context: [
      { icon: Scale, label: 'Sveriges lagar' },
      { icon: BookOpen, label: 'Rättskällor' },
    ],
    missing: [
      { icon: ListChecks, label: 'Er laglista & krav' },
      { icon: FileText, label: 'Era styrdokument' },
      { icon: ClipboardCheck, label: 'Era uppgifter & status' },
      { icon: Users, label: 'Ansvariga' },
    ],
    verdict:
      'Kan lagen — men känner inte just er verksamhet. Råden blir generiska.',
  },
  {
    name: 'Laglig',
    desc: 'Komplett kunskapsgraf',
    hero: true,
    context: [
      { icon: Scale, label: 'Sveriges lagar' },
      { icon: ListChecks, label: 'Er laglista & krav' },
      { icon: FileText, label: 'Era styrdokument' },
      { icon: ClipboardCheck, label: 'Era uppgifter & status' },
      { icon: Users, label: 'Ansvariga' },
      { icon: RefreshCw, label: 'Lagändringar i realtid' },
    ],
    verdict:
      'Grundat i exakta lagrum och hela er verksamhet — och föreslår nästa steg.',
  },
]

// per-chip tint for the Laglig column — near-monochrome on dark with the single
// sanctioned amber accent (the brand palette); the green Check marks carry the
// "has it" status signal, so the chips themselves stay ink-toned.
const HERO_CHIP_TONE = [
  'text-amber-400',
  'text-background/80',
  'text-background/80',
  'text-background/80',
  'text-background/80',
  'text-amber-400',
]

function ComparisonColumn({ col, index }: { col: Column; index: number }) {
  const { hero } = col
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl p-6',
        hero
          ? 'relative bg-background/[0.07] ring-2 ring-amber-400/40 shadow-[0_24px_70px_-20px_rgba(245,158,11,0.35)] lg:-mt-4 lg:mb-[-1rem]'
          : 'border border-background/10 bg-background/[0.035]'
      )}
    >
      {hero && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-medium text-foreground">
          <Sparkles className="h-3 w-3" /> Hela bilden
        </span>
      )}

      {/* header */}
      <div className="flex items-center gap-3">
        {hero ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-icon-black.png"
              alt="Laglig"
              className="h-4 w-auto"
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/10 text-background/60 ring-1 ring-background/10">
            {index === 0 ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
          </div>
        )}
        <div>
          <p
            className="text-[15px] font-medium leading-tight"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            {col.name}
          </p>
          <p className="text-[13px] text-background/55">{col.desc}</p>
        </div>
      </div>

      {/* context stack */}
      <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-background/45">
        Har i kontexten
      </p>
      <ul className="mt-3 flex-1 space-y-1.5">
        {col.context.map((chip, i) => (
          <li
            key={chip.label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]',
              hero
                ? 'bg-background/[0.07] ring-1 ring-background/10'
                : 'bg-background/[0.05] text-background/70'
            )}
          >
            <chip.icon
              className={cn(
                'h-4 w-4 shrink-0',
                hero ? HERO_CHIP_TONE[i] : 'text-background/45'
              )}
            />
            <span className={cn(hero ? 'font-medium text-background' : '')}>
              {chip.label}
            </span>
            {hero && <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />}
          </li>
        ))}
        {col.missing?.map((chip) => (
          <li
            key={chip.label}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-background/15 px-2.5 py-2 text-[13px]"
          >
            <chip.icon className="h-4 w-4 shrink-0 text-background/25" />
            <span className="text-background/35">{chip.label}</span>
            <X className="ml-auto h-3.5 w-3.5 text-background/25" />
          </li>
        ))}
      </ul>

      {/* verdict */}
      <div
        className={cn(
          'mt-6 flex items-start gap-2 border-t pt-4 text-[13px] leading-snug',
          hero
            ? 'border-background/15 text-background'
            : 'border-background/10 text-background/60'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
            hero
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-background/10 text-background/50'
          )}
        >
          {hero ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        </span>
        {col.verdict}
      </div>
    </div>
  )
}

export function AiComparisonSection() {
  return (
    <section className="relative pb-10 pt-20 md:pb-14 md:pt-28">
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="mx-auto mb-5 max-w-2xl text-3xl font-medium leading-[1.1] tracking-tight md:text-5xl lg:text-6xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Andra ser en bit.
            <span className="block text-background/45">
              Laglig ser helheten.
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-lg opacity-75 md:text-xl">
            Ett svar är bara så bra som kontexten bakom det. Laglig har lagen
            och hela er verksamhet i samma graf — inte bara lagtexten.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-5 md:grid-cols-3">
          {COLUMNS.map((col, i) => (
            <ComparisonColumn key={col.name} col={col} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

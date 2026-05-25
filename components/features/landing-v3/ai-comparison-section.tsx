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
 * AI comparison module (sits beneath the knowledge-graph section). Three tiers
 * of AI, framed by how much of *your* world is in the context:
 *   1. Vanlig AI      — general knowledge, guesses
 *   2. Juridisk AI    — knows the law, but not you
 *   3. Laglig         — the law + your full operating picture (the graph)
 * The growing stack of "context" chips is the punchline.
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

// per-chip tint for the Laglig column (ties back to the graph node colours)
const HERO_CHIP_TONE = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-foreground/70',
  'text-amber-600 dark:text-amber-400',
  'text-foreground',
  'text-rose-600 dark:text-rose-400',
]

function ComparisonColumn({ col, index }: { col: Column; index: number }) {
  const { hero } = col
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl p-6',
        hero
          ? 'relative bg-card shadow-[0_24px_60px_-24px_rgba(0,0,0,0.22)] ring-2 ring-primary/25 lg:-mt-4 lg:mb-[-1rem]'
          : 'border border-border/70 bg-card/50'
      )}
    >
      {hero && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
          <Sparkles className="h-3 w-3" /> Hela bilden
        </span>
      )}

      {/* header */}
      <div className="flex items-center gap-3">
        {hero ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-icon-white.png"
              alt="Laglig"
              className="h-4 w-auto"
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
            {index === 0 ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
          </div>
        )}
        <div>
          <p className="text-[15px] font-medium leading-tight">{col.name}</p>
          <p className="text-[13px] text-muted-foreground">{col.desc}</p>
        </div>
      </div>

      {/* context stack */}
      <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Har i kontexten
      </p>
      <ul className="mt-3 flex-1 space-y-1.5">
        {col.context.map((chip, i) => (
          <li
            key={chip.label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]',
              hero
                ? 'bg-background ring-1 ring-border/60'
                : 'bg-muted/60 text-foreground/70'
            )}
          >
            <chip.icon
              className={cn(
                'h-4 w-4 shrink-0',
                hero ? HERO_CHIP_TONE[i] : 'text-muted-foreground'
              )}
            />
            <span className={cn(hero ? 'font-medium text-foreground' : '')}>
              {chip.label}
            </span>
            {hero && (
              <Check className="ml-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
          </li>
        ))}
        {col.missing?.map((chip) => (
          <li
            key={chip.label}
            className="flex items-center gap-2.5 rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-[13px]"
          >
            <chip.icon className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            <span className="text-muted-foreground/55">{chip.label}</span>
            <X className="ml-auto h-3.5 w-3.5 text-muted-foreground/40" />
          </li>
        ))}
      </ul>

      {/* verdict */}
      <div
        className={cn(
          'mt-6 flex items-start gap-2 border-t pt-4 text-[13px] leading-snug',
          hero
            ? 'border-border/45 text-foreground'
            : 'border-border/45 text-muted-foreground'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
            hero
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
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
    <section className="relative overflow-hidden bg-background py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Skillnaden
          </span>
          <h2
            className="mx-auto mt-5 max-w-2xl text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-[2.75rem]"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Andra AI ser en bit.
            <span className="block text-foreground/45">
              Laglig ser helheten.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
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

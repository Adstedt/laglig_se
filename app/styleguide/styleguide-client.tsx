'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Bell, FileText, Inbox, Monitor, Moon, Search, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  TONES,
  VARIANTS,
  getPriorityBadgeProps,
  getStatusBadgeProps,
  type PriorityValue,
} from '@/lib/ui/badge-tones'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ColorTagBadge } from '@/components/ui/color-tag-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ---------------------------------------------------------------------------
// Table of contents — section id ↔ label. Add a Section with a matching id
// and it appears in the sticky nav automatically.
// ---------------------------------------------------------------------------
const TOC: { id: string; label: string }[] = [
  { id: 'colors', label: 'Färgtokens' },
  { id: 'typography', label: 'Typografi' },
  { id: 'radius', label: 'Radie & spacing' },
  { id: 'buttons', label: 'Button' },
  { id: 'badges', label: 'Badge' },
  { id: 'status-badges', label: 'Status-badges' },
  { id: 'color-tags', label: 'ColorTagBadge' },
  { id: 'filter-chips', label: 'FilterChip' },
  { id: 'alerts', label: 'Alert' },
  { id: 'cards', label: 'Card' },
  { id: 'forms', label: 'Formulär' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'accordion', label: 'Accordion' },
  { id: 'feedback', label: 'Tooltip / Skeleton / Progress' },
  { id: 'empty-state', label: 'EmptyState' },
  { id: 'pattern-legal', label: 'Mönster: Lagtext' },
  { id: 'pattern-agent', label: 'Mönster: Agent-kort' },
  { id: 'pattern-stream', label: 'Mönster: Chatt / Streamdown' },
]

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-5">
      <div className="space-y-1">
        <h2 className="font-safiro text-2xl font-medium tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** A labelled specimen block: component name + source path + the rendering. */
function Specimen({
  name,
  source,
  children,
  className,
}: {
  name?: string
  source?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="rounded-lg border bg-card">
      {(name || source) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2">
          {name ? (
            <span className="text-sm font-medium">{name}</span>
          ) : (
            <span />
          )}
          {source ? (
            <code className="text-[11px] text-muted-foreground">{source}</code>
          ) : null}
        </div>
      )}
      <div className={cn('p-5', className)}>{children}</div>
    </div>
  )
}

/** A single design-token color swatch. */
function Swatch({ varName, label }: { varName: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <div
        className="h-14 w-full rounded-md border"
        style={{ backgroundColor: `hsl(var(--${varName}))` }}
      />
      <div className="space-y-0.5">
        <div className="text-xs font-medium leading-none">{label}</div>
        <code className="text-[10px] text-muted-foreground">--{varName}</code>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Theme toggle (segmented Light / System / Dark)
// ---------------------------------------------------------------------------
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const options = [
    { value: 'light', icon: Sun, label: 'Ljust' },
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'dark', icon: Moon, label: 'Mörkt' },
  ] as const

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-background p-1">
      {options.map(({ value, icon: Icon, label }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            title={label}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Token definitions for the Colors section
// ---------------------------------------------------------------------------
const SEMANTIC_TOKENS: { varName: string; label: string }[] = [
  { varName: 'background', label: 'Background' },
  { varName: 'foreground', label: 'Foreground' },
  { varName: 'card', label: 'Card' },
  { varName: 'popover', label: 'Popover' },
  { varName: 'primary', label: 'Primary' },
  { varName: 'secondary', label: 'Secondary' },
  { varName: 'muted', label: 'Muted' },
  { varName: 'muted-foreground', label: 'Muted fg' },
  { varName: 'accent', label: 'Accent' },
  { varName: 'destructive', label: 'Destructive' },
  { varName: 'border', label: 'Border' },
  { varName: 'ring', label: 'Ring' },
]

const TONE_TOKENS: { varName: string; label: string }[] = [
  { varName: 'tone-success-soft-bg', label: 'Success bg' },
  { varName: 'tone-success-soft-fg', label: 'Success fg' },
  { varName: 'tone-warning-soft-bg', label: 'Warning bg' },
  { varName: 'tone-warning-soft-fg', label: 'Warning fg' },
  { varName: 'tone-danger-soft-bg', label: 'Danger bg' },
  { varName: 'tone-danger-soft-fg', label: 'Danger fg' },
  { varName: 'tone-info-soft-bg', label: 'Info bg' },
  { varName: 'tone-info-soft-fg', label: 'Info fg' },
]

const ATMOSPHERE_TOKENS: { varName: string; label: string }[] = [
  { varName: 'section-warm', label: 'Section warm' },
  { varName: 'section-sage', label: 'Section sage' },
  { varName: 'section-cream', label: 'Section cream' },
  { varName: 'spine-top', label: 'Spine top' },
  { varName: 'spine-bot', label: 'Spine bottom' },
]

const BUTTON_VARIANTS = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function StyleguideClient() {
  const [chips, setChips] = React.useState({
    avvikelse: true,
    observation: false,
    forbattring: false,
  })
  const [progress, setProgress] = React.useState(62)

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <div className="min-w-0">
              <h1 className="font-safiro text-lg font-medium tracking-tight">
                Komponentindex
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Levande katalog — renderar de riktiga komponenterna, inte kopior
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
          {/* Sticky TOC */}
          <nav className="hidden w-48 shrink-0 lg:block">
            <ul className="sticky top-20 space-y-0.5">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="min-w-0 flex-1 space-y-14">
            {/* ---------------------------------------------------- COLORS */}
            <Section
              id="colors"
              title="Färgtokens"
              description="HSL-variabler i globals.css. Byt tema uppe till höger för att se ljusa/mörka värden."
            >
              <Specimen name="Semantiska tokens">
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                  {SEMANTIC_TOKENS.map((t) => (
                    <Swatch key={t.varName} {...t} />
                  ))}
                </div>
              </Specimen>
              <Specimen name="Tone-tokens (chips, pills, diff-block)">
                <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
                  {TONE_TOKENS.map((t) => (
                    <Swatch key={t.varName} {...t} />
                  ))}
                </div>
              </Specimen>
              <Specimen name="Atmosfär (sektionstoner + agent-spine)">
                <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
                  {ATMOSPHERE_TOKENS.map((t) => (
                    <Swatch key={t.varName} {...t} />
                  ))}
                </div>
              </Specimen>
            </Section>

            {/* ------------------------------------------------ TYPOGRAPHY */}
            <Section
              id="typography"
              title="Typografi"
              description="Safiro (display) + Google Sans Flex / sans (brödtext)."
            >
              <Specimen
                name="Safiro — display"
                source="font-safiro font-medium"
              >
                <Alert className="mb-5 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTitle>Safiro finns bara i vikt 500</AlertTitle>
                  <AlertDescription>
                    Para alltid med <code>font-medium</code>. Med{' '}
                    <code>font-bold</code>/<code>font-semibold</code>{' '}
                    fejk-bold:ar webbläsaren teckensnittet eller faller tillbaka
                    till system-ui.
                  </AlertDescription>
                </Alert>
                <div className="space-y-3 font-safiro font-medium tracking-tight">
                  <p className="text-4xl">Lagefterlevnad, på riktigt</p>
                  <p className="text-2xl">Bevaka, bygg laglistor, säkerställ</p>
                  <p className="text-lg">Rubrik på sektionsnivå</p>
                </div>
              </Specimen>
              <Specimen name="Brödtext — skala">
                <div className="space-y-2">
                  <p className="text-xl">text-xl — Större ingress</p>
                  <p className="text-lg">text-lg — Ingress</p>
                  <p className="text-base">
                    text-base — Brödtext för normalt innehåll.
                  </p>
                  <p className="text-sm">
                    text-sm — Sekundär text, vanlig i tabeller och kort.
                  </p>
                  <p className="text-xs">text-xs — Metadata och etiketter.</p>
                  <p className="text-sm text-muted-foreground">
                    text-muted-foreground — dämpad text för bisaker.
                  </p>
                </div>
              </Specimen>
            </Section>

            {/* --------------------------------------------------- RADIUS */}
            <Section
              id="radius"
              title="Radie & spacing"
              description="--radius = 0.5rem. Tailwind rounded-* utgår från den."
            >
              <Specimen>
                <div className="flex flex-wrap items-end gap-6">
                  {[
                    { cls: 'rounded-sm', label: 'sm' },
                    { cls: 'rounded-md', label: 'md' },
                    { cls: 'rounded-lg', label: 'lg' },
                    { cls: 'rounded-xl', label: 'xl' },
                    { cls: 'rounded-full', label: 'full' },
                  ].map(({ cls, label }) => (
                    <div key={cls} className="space-y-1.5 text-center">
                      <div className={cn('size-16 border bg-muted', cls)} />
                      <code className="text-[10px] text-muted-foreground">
                        {label}
                      </code>
                    </div>
                  ))}
                </div>
              </Specimen>
            </Section>

            {/* -------------------------------------------------- BUTTONS */}
            <Section
              id="buttons"
              title="Button"
              description="6 varianter × 4 storlekar."
            >
              <Specimen source="components/ui/button.tsx">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    {BUTTON_VARIANTS.map((variant) => (
                      <Button key={variant} variant={variant}>
                        {variant}
                      </Button>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">sm</Button>
                    <Button size="default">default</Button>
                    <Button size="lg">lg</Button>
                    <Button size="icon" aria-label="Sök">
                      <Search />
                    </Button>
                    <Button disabled>disabled</Button>
                    <Button>
                      <FileText /> Med ikon
                    </Button>
                  </div>
                </div>
              </Specimen>
            </Section>

            {/* --------------------------------------------------- BADGES */}
            <Section
              id="badges"
              title="Badge"
              description="Tone × variant-rutnätet (källan för alla status-pills) + legacy-varianter."
            >
              <Specimen name="Tone × variant" source="lib/ui/badge-tones.ts">
                <div className="space-y-3">
                  <div className="grid grid-cols-[5rem_repeat(3,1fr)] items-center gap-3 text-xs text-muted-foreground">
                    <span />
                    {VARIANTS.map((v) => (
                      <span key={v} className="font-medium">
                        {v}
                      </span>
                    ))}
                  </div>
                  {TONES.map((tone) => (
                    <div
                      key={tone}
                      className="grid grid-cols-[5rem_repeat(3,1fr)] items-center gap-3"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {tone}
                      </span>
                      {VARIANTS.map((variant) => (
                        <span key={variant}>
                          <Badge tone={tone} variant={variant}>
                            {tone}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </Specimen>
              <Specimen name="Legacy shadcn-varianter (ej för status)">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="default">default</Badge>
                  <Badge variant="secondary">secondary</Badge>
                  <Badge variant="destructive">destructive</Badge>
                  <Badge variant="outline">outline</Badge>
                </div>
              </Specimen>
            </Section>

            {/* ------------------------------------------- STATUS BADGES */}
            <Section
              id="status-badges"
              title="Status-badges (domänmappade)"
              description="getStatusBadgeProps / getPriorityBadgeProps — domänvärde → (tone, variant, etikett)."
            >
              <Specimen
                name="Efterlevnadsstatus"
                source="getStatusBadgeProps('compliance-status', …)"
              >
                <div className="flex flex-wrap gap-3">
                  {[
                    'EJ_PABORJAD',
                    'PAGAENDE',
                    'UPPFYLLD',
                    'EJ_UPPFYLLD',
                    'EJ_TILLAMPLIG',
                  ].map((v) => {
                    const p = getStatusBadgeProps('compliance-status', v)
                    return (
                      <Badge key={v} tone={p.tone} variant={p.variant}>
                        {p.label}
                      </Badge>
                    )
                  })}
                </div>
              </Specimen>
              <Specimen name="Kontrollstatus + Prioritet">
                <div className="flex flex-wrap items-center gap-3">
                  {['PLANERAD', 'PAGAENDE', 'AVSLUTAD'].map((v) => {
                    const p = getStatusBadgeProps('cycle-status', v)
                    return (
                      <Badge key={v} tone={p.tone} variant={p.variant}>
                        {p.label}
                      </Badge>
                    )
                  })}
                  <Separator orientation="vertical" className="h-5" />
                  {(
                    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as PriorityValue[]
                  ).map((v) => {
                    const p = getPriorityBadgeProps(v)
                    return (
                      <Badge key={v} tone={p.tone} variant={p.variant}>
                        {p.label}
                      </Badge>
                    )
                  })}
                </div>
              </Specimen>
            </Section>

            {/* ----------------------------------------------- COLOR TAGS */}
            <Section
              id="color-tags"
              title="ColorTagBadge"
              description="Användarvalda taggfärger — bakgrund/kant härleds från hex."
            >
              <Specimen source="components/ui/color-tag-badge.tsx">
                <div className="flex flex-wrap items-center gap-3">
                  <ColorTagBadge name="Miljö" color="#16a34a" />
                  <ColorTagBadge name="Arbetsmiljö" color="#2563eb" />
                  <ColorTagBadge name="Brand" color="#dc2626" />
                  <ColorTagBadge name="GDPR" color="#9333ea" />
                  <ColorTagBadge name="Liten" color="#ca8a04" size="sm" />
                  <ColorTagBadge
                    name="Utan prick"
                    color="#0891b2"
                    showDot={false}
                  />
                </div>
              </Specimen>
            </Section>

            {/* --------------------------------------------- FILTER CHIPS */}
            <Section
              id="filter-chips"
              title="FilterChip"
              description="Filtertoggles (aria-pressed). Inte tabs — reservera Tabs för vyväxling."
            >
              <Specimen source="components/ui/filter-chip.tsx">
                <FilterChipGroup aria-label="Filtrera anmärkningar efter typ">
                  <FilterChip
                    pressed={chips.avvikelse}
                    onPressedChange={(p) =>
                      setChips((c) => ({ ...c, avvikelse: p }))
                    }
                    count={4}
                  >
                    Avvikelse
                  </FilterChip>
                  <FilterChip
                    pressed={chips.observation}
                    onPressedChange={(p) =>
                      setChips((c) => ({ ...c, observation: p }))
                    }
                    count={7}
                  >
                    Observation
                  </FilterChip>
                  <FilterChip
                    pressed={chips.forbattring}
                    onPressedChange={(p) =>
                      setChips((c) => ({ ...c, forbattring: p }))
                    }
                    icon={<Bell />}
                    count={2}
                  >
                    Förbättring
                  </FilterChip>
                </FilterChipGroup>
              </Specimen>
            </Section>

            {/* --------------------------------------------------- ALERTS */}
            <Section id="alerts" title="Alert">
              <Specimen source="components/ui/alert.tsx">
                <div className="space-y-4">
                  <Alert>
                    <FileText className="size-4" />
                    <AlertTitle>Standard</AlertTitle>
                    <AlertDescription>
                      En neutral notis med ikon, rubrik och beskrivning.
                    </AlertDescription>
                  </Alert>
                  <Alert variant="destructive">
                    <Bell className="size-4" />
                    <AlertTitle>Destructive</AlertTitle>
                    <AlertDescription>
                      Något gick fel och kräver din uppmärksamhet.
                    </AlertDescription>
                  </Alert>
                </div>
              </Specimen>
            </Section>

            {/* ---------------------------------------------------- CARDS */}
            <Section id="cards" title="Card">
              <Specimen source="components/ui/card.tsx">
                <Card className="max-w-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Arbetsmiljölagen</CardTitle>
                    <CardDescription>
                      SFS 1977:1160 · senast uppdaterad 2026-04
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    12 kravpunkter, varav 9 uppfyllda. 2 uppgifter saknar bevis.
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button size="sm">Öppna</Button>
                    <Button size="sm" variant="outline">
                      Detaljer
                    </Button>
                  </CardFooter>
                </Card>
              </Specimen>
            </Section>

            {/* --------------------------------------------------- FORMS */}
            <Section id="forms" title="Formulärkontroller">
              <Specimen>
                <div className="grid max-w-xl gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sg-input">Input</Label>
                    <Input
                      id="sg-input"
                      placeholder="Sök lag eller föreskrift"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Select</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ej">Ej påbörjad</SelectItem>
                        <SelectItem value="delvis">Delvis uppfylld</SelectItem>
                        <SelectItem value="uppfylld">Uppfylld</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sg-textarea">Textarea</Label>
                    <Textarea
                      id="sg-textarea"
                      placeholder="Hur efterlever ni kraven?"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch id="sg-switch" defaultChecked />
                    <Label htmlFor="sg-switch">Kräver bevis</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="sg-check" defaultChecked />
                    <Label htmlFor="sg-check">Markera som klar</Label>
                  </div>
                </div>
              </Specimen>
            </Section>

            {/* ----------------------------------------------------- TABS */}
            <Section
              id="tabs"
              title="Tabs"
              description="Endast för vyväxling. För filter, använd FilterChip."
            >
              <Specimen source="components/ui/tabs.tsx">
                <Tabs defaultValue="items" className="max-w-md">
                  <TabsList>
                    <TabsTrigger value="items">Punkter</TabsTrigger>
                    <TabsTrigger value="findings">Anmärkningar</TabsTrigger>
                    <TabsTrigger value="report">Rapport</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="items"
                    className="text-sm text-muted-foreground"
                  >
                    Lista över kontrollpunkter.
                  </TabsContent>
                  <TabsContent
                    value="findings"
                    className="text-sm text-muted-foreground"
                  >
                    Avvikelser och observationer.
                  </TabsContent>
                  <TabsContent
                    value="report"
                    className="text-sm text-muted-foreground"
                  >
                    Revisionsrapport.
                  </TabsContent>
                </Tabs>
              </Specimen>
            </Section>

            {/* ------------------------------------------------ ACCORDION */}
            <Section id="accordion" title="Accordion">
              <Specimen source="components/ui/accordion.tsx">
                <Accordion type="single" collapsible className="max-w-md">
                  <AccordionItem value="a">
                    <AccordionTrigger>Kravpunkter</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      Checklista med dual-surface inline-editor.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="b">
                    <AccordionTrigger>Länkade artefakter</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      Filer och dokument kopplade till listposten.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Specimen>
            </Section>

            {/* ----------------------------------------------- FEEDBACK */}
            <Section
              id="feedback"
              title="Tooltip · Skeleton · Progress · Avatar"
            >
              <Specimen>
                <div className="flex flex-wrap items-center gap-8">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">Hovra för tooltip</Button>
                    </TooltipTrigger>
                    <TooltipContent>Visas vid hover/fokus</TooltipContent>
                  </Tooltip>

                  <div className="flex items-center -space-x-2">
                    <Avatar className="border-2 border-background">
                      <AvatarFallback>AA</AvatarFallback>
                    </Avatar>
                    <Avatar className="border-2 border-background">
                      <AvatarFallback>KB</AvatarFallback>
                    </Avatar>
                    <Avatar className="border-2 border-background">
                      <AvatarFallback>+3</AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                <Separator className="my-5" />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                </div>

                <Separator className="my-5" />

                <div className="max-w-sm space-y-3">
                  <Progress value={progress} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProgress((p) => Math.max(0, p - 10))}
                    >
                      −10
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProgress((p) => Math.min(100, p + 10))}
                    >
                      +10
                    </Button>
                    <span className="self-center text-sm text-muted-foreground tabular-nums">
                      {progress}%
                    </span>
                  </div>
                </div>
              </Specimen>
            </Section>

            {/* ----------------------------------------------- EMPTY STATE */}
            <Section id="empty-state" title="EmptyState">
              <Specimen source="components/ui/empty-state.tsx">
                <EmptyState
                  icon={
                    <EmptyState.Icon>
                      <Inbox className="size-6 text-muted-foreground" />
                    </EmptyState.Icon>
                  }
                  title="Inga uppgifter ännu"
                  description="När du skapar uppgifter dyker de upp här."
                  action={<Button size="sm">Ny uppgift</Button>}
                />
              </Specimen>
            </Section>

            {/* ------------------------------------------- PATTERN: LEGAL */}
            <Section
              id="pattern-legal"
              title="Mönster: Lagtext"
              description=".legal-document — den skräddarsydda renderingen för SFS/AFS-innehåll."
            >
              <Specimen source="globals.css · .legal-document">
                <div className="legal-document">
                  <h2>1 kap. Inledande bestämmelser</h2>
                  {/* Mirrors real law markup: .legal-document a.paragraf is the
                      § marker, styled via globals.css. No href by design. */}
                  {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                  <a className="paragraf">1 §</a>
                  <p>
                    Lagens ändamål är att förebygga ohälsa och olycksfall i
                    arbetet samt att även i övrigt uppnå en god arbetsmiljö.
                  </p>
                  <div className="allmanna-rad">
                    <div className="allmanna-rad-heading">Allmänna råd</div>
                    <p>
                      Vägledande, icke-bindande text renderas som en varm
                      marginalanteckning för att skilja registret från bindande
                      lagtext.
                    </p>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Paragraf</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>2 §</td>
                        <td>Uppfylld</td>
                      </tr>
                      <tr>
                        <td>3 §</td>
                        <td>Delvis</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Specimen>
            </Section>

            {/* ------------------------------------------- PATTERN: AGENT */}
            <Section
              id="pattern-agent"
              title="Mönster: Agent-kort"
              description="Den varma → salvia-färgade ryggraden + den lugnt pulserande beslutsindikatorn."
            >
              <Specimen source="globals.css · .agent-spine / .agent-dot-pending">
                <div className="flex max-w-md gap-3 rounded-lg border bg-card p-4">
                  <div className="agent-spine w-1 shrink-0 self-stretch" />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="agent-dot-pending relative inline-block size-2 rounded-full"
                        style={{ backgroundColor: 'hsl(var(--spine-top))' }}
                      />
                      <span className="text-sm font-medium">
                        Väntar på ditt beslut
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Agenten föreslår att skapa en uppgift kopplad till
                      kravpunkt 3 §. Granska och godkänn.
                    </p>
                  </div>
                </div>
              </Specimen>
            </Section>

            {/* ------------------------------------------ PATTERN: STREAM */}
            <Section
              id="pattern-stream"
              title="Mönster: Chatt / Streamdown"
              description="Tabell- och tänkande-indikatorer som AI-chatten använder."
            >
              <Specimen source="globals.css · .streamdown / .thinking-*">
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="thinking-shimmer-text">Tänker</span>
                    <span className="inline-flex gap-1">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  </div>
                  <div className="streamdown">
                    <table>
                      <thead>
                        <tr>
                          <th>Lag</th>
                          <th>Kravpunkter</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Arbetsmiljölagen</td>
                          <td>12</td>
                          <td>Pågående</td>
                        </tr>
                        <tr>
                          <td>GDPR</td>
                          <td>8</td>
                          <td>Uppfylld</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Specimen>
            </Section>

            <footer className="border-t pt-6 text-xs text-muted-foreground">
              Renderat från shipping-källan. Ändra en token i{' '}
              <code>globals.css</code> eller en CVA-variant i{' '}
              <code>components/ui/*</code> och alla exemplar här uppdateras.
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

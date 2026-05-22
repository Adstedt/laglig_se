'use client'

import { useRef, useState, useEffect } from 'react'
import {
  Home,
  MessageSquare,
  Scale,
  ClipboardCheck,
  BookOpen,
  ListChecks,
  FileText,
  FolderClosed,
  Activity,
  Users,
  LifeBuoy,
  Settings,
  Bell,
  Search,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LaglistorView,
  AssistentView,
  KontrollView,
  StyrdokumentView,
  RegelverkView,
} from './hero-shot-views'

/**
 * Interactive (navigable) product shot for the landing hero. The left rail is
 * the navigation — clicking a function swaps the panel, exactly like the real
 * app. The panel content uses the REAL app components fed hardcoded data.
 *
 * The shot renders at a fixed design size (wide enough for the real, fixed-width
 * compliance table) and scales-to-fit its container, so all columns are
 * preserved at every viewport. The rail stays interactive; panel content is
 * presentational (`pointer-events-none`).
 */

// Sized so the content area ≈ the real compliance table's natural column sum
// (~1469px) + rail + padding, so its trailing spacer column collapses to ~0
// and there's no wasted width. Scales-to-fit narrower (laptop) viewports.
const DESIGN_W = 1640
const DESIGN_H = 1080

type View =
  | 'laglistor'
  | 'assistent'
  | 'kontroll'
  | 'styrdokument'
  | 'regelverk'

type NavItem = { icon: typeof Home; view: View | null; label: string }

const NAV_TOP: NavItem[] = [
  { icon: Home, view: null, label: 'Hem' },
  { icon: MessageSquare, view: 'assistent', label: 'Assistent' },
  { icon: Scale, view: 'laglistor', label: 'Efterlevnad' },
  { icon: ClipboardCheck, view: 'kontroll', label: 'Kontroller' },
  { icon: BookOpen, view: 'regelverk', label: 'Regelverk' },
]
const NAV_MID: NavItem[] = [
  { icon: ListChecks, view: null, label: 'Uppgifter' },
  { icon: FileText, view: 'styrdokument', label: 'Styrdokument' },
  { icon: FolderClosed, view: null, label: 'Filer' },
  { icon: Activity, view: null, label: 'Aktivitetslogg' },
  { icon: Users, view: null, label: 'Medlemmar' },
]

const VIEWS: Record<View, () => React.JSX.Element> = {
  laglistor: LaglistorView,
  assistent: AssistentView,
  kontroll: KontrollView,
  styrdokument: StyrdokumentView,
  regelverk: RegelverkView,
}

export function HeroProductShot() {
  const [view, setView] = useState<View>('laglistor')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.62)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ActiveView = VIEWS[view]

  const renderNav = (items: NavItem[], group: string) =>
    items.map((item, i) => {
      const active = item.view !== null && item.view === view
      const clickable = item.view !== null
      const Icon = item.icon
      return (
        <button
          key={`${group}${i}`}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={clickable ? () => setView(item.view as View) : undefined}
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors',
            clickable &&
              'cursor-pointer hover:bg-accent/60 hover:text-foreground',
            !clickable && 'cursor-default',
            active && 'bg-accent text-foreground'
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
          {active && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
        </button>
      )
    })

  return (
    <div
      ref={wrapRef}
      className="relative w-full animate-fade-up select-none overflow-hidden"
      style={{ height: Math.round(DESIGN_H * scale) }}
    >
      <div
        className="absolute left-0 top-0 flex bg-background text-left font-sans text-foreground"
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Left rail — the navigation */}
        <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border/70 bg-card py-3">
          <div className="flex h-8 w-full items-center justify-center">
            {/* eslint-disable @next/next/no-img-element */}
            <img
              src="/images/logo-icon-black.png"
              alt="Laglig"
              className="h-5 w-auto dark:hidden"
            />
            <img
              src="/images/logo-icon-white.png"
              alt=""
              className="hidden h-5 w-auto dark:block"
            />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <div className="mt-4 flex flex-1 flex-col items-center gap-1">
            {renderNav(NAV_TOP, 't')}
            <div className="my-1 h-px w-6 bg-border/70" />
            {renderNav(NAV_MID, 'm')}
          </div>
          <div className="flex flex-col items-center gap-2">
            <LifeBuoy className="h-[18px] w-[18px] text-muted-foreground" />
            <Settings className="h-[18px] w-[18px] text-muted-foreground" />
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
              N
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              AA
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar (chrome) */}
          <div className="pointer-events-none flex h-14 shrink-0 items-center gap-3 border-b border-border/70 px-5">
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
              Skapa
            </div>
            <div className="flex w-64 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              Sök lagar, föreskrifter…
            </div>
            <div className="relative">
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-semibold text-white">
                4
              </span>
            </div>
          </div>

          {/* Panel */}
          <div className="pointer-events-none flex-1 overflow-hidden px-6 pt-5">
            <div key={view} className="animate-fade-up">
              <ActiveView />
            </div>
          </div>
        </div>
      </div>

      {/* Soft bottom fade — no hard cutoff */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}

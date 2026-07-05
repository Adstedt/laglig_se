'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  ChevronDown,
  ArrowRight,
  Scale,
  Bell,
  ListChecks,
  ClipboardList,
  FileText,
  ClipboardCheck,
  Sparkles,
  BookOpen,
  Globe,
  Search,
  Library,
  UtensilsCrossed,
  HardHat,
  HeartPulse,
  Factory,
  Truck,
  Cpu,
  Building2,
  Lock,
  Network,
  Users,
  Flame,
  Leaf,
  Megaphone,
  Banknote,
  Award,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'

import {
  FUNKTIONER_NAV,
  BRANSCHER_NAV,
  OMRADEN_NAV,
  resolveNavHref,
  type MarketingNavItem,
} from '@/lib/marketing/nav-links'

// ── Mega-menu content ───────────────────────────────────────────────────────
// Produkt/Branscher/Områden route data lives in lib/marketing/nav-links.ts
// (client-safe, canonical slugs). Items resolve per render against the
// `publishedRoutes` prop: published page → real link; unpublished Produkt
// item → homepage-anchor fallback; unpublished bransch/område → "Kommer
// snart". Icons stay here — lucide components aren't serializable data.

type MenuLink = {
  href: string
  title: string
  desc?: string
  icon?: LucideIcon
}

// Icon per canonical route. Områden icons follow the iconForArea conventions
// from org-check-form.tsx (Lock=GDPR, Flame=brandskydd, Leaf=miljö, …) so the
// same concept carries the same icon across surfaces.
const NAV_ICONS: Record<string, LucideIcon> = {
  '/funktioner/laglista': Scale,
  '/funktioner/kravpunkter': ClipboardList,
  '/funktioner/lagandringar': Bell,
  '/funktioner/uppgifter': ListChecks,
  '/funktioner/styrdokument': FileText,
  '/funktioner/kontroller': ClipboardCheck,
  '/funktioner/ai-agent': Sparkles,
  '/branscher/hotell-restaurang': UtensilsCrossed,
  '/branscher/bygg': HardHat,
  '/branscher/vard-omsorg': HeartPulse,
  '/branscher/industri': Factory,
  '/branscher/transport': Truck,
  '/branscher/it': Cpu,
  '/branscher/fastighet': Building2,
  '/omraden/gdpr': Lock,
  '/omraden/nis2': Network,
  '/omraden/arbetsmiljo': Users,
  '/omraden/brandskydd': Flame,
  '/omraden/miljo': Leaf,
  '/omraden/visselblasarlagen': Megaphone,
  '/omraden/penningtvatt': Banknote,
  '/omraden/iso-14001': Award,
}

const PRODUKT_MORE: MenuLink[] = [
  { href: '/#how-it-works', title: 'Så fungerar det' },
  { href: '/#skala', title: 'För hela företaget' },
  { href: '/#pricing', title: 'Priser' },
  { href: '/#faq', title: 'Vanliga frågor' },
]

const REGELVERK: MenuLink[] = [
  {
    href: '/rattskallor',
    title: 'Bläddra alla',
    desc: 'Alla rättskällor på ett ställe — lagar, EU och föreskrifter',
    icon: Library,
  },
  {
    href: '/lagar',
    title: 'Svenska lagar',
    desc: 'Alla lagar och förordningar — fria att läsa',
    icon: BookOpen,
  },
  {
    href: '/rattskallor?types=AGENCY_REGULATION',
    title: 'Föreskrifter',
    desc: 'Regler från myndigheter, t.ex. AFS och MSBFS',
    icon: FileText,
  },
  {
    href: '/eu',
    title: 'EU-regler',
    desc: 'EU-förordningar och direktiv som gäller i Sverige',
    icon: Globe,
  },
  {
    href: '/sok',
    title: 'Sök i lagboken',
    desc: 'Sök fritt i alla lagar och regler',
    icon: Search,
  },
]

const triggerCls =
  'h-9 rounded-full bg-transparent px-4 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[state=open]:bg-foreground/[0.04]'

const featureLinkCls =
  'group/item flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-foreground/[0.03]'

function FeatureLinkBody({
  item,
  comingSoon = false,
}: {
  item: {
    title: string
    desc?: string | undefined
    icon?: LucideIcon | undefined
  }
  comingSoon?: boolean
}) {
  return (
    <>
      {item.icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/70 ring-1 ring-border/50 transition-all group-hover/item:bg-amber-100 group-hover/item:text-amber-700 group-hover/item:ring-amber-200/70">
          <item.icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-safiro text-sm font-medium leading-none tracking-tight">
          {item.title}
          {comingSoon && (
            <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Kommer snart
            </span>
          )}
        </span>
        {item.desc && (
          <span className="mt-1 block truncate text-[12.5px] leading-snug text-muted-foreground">
            {item.desc}
          </span>
        )}
      </span>
    </>
  )
}

function FeatureLink({ item }: { item: MenuLink }) {
  // Real routes go through next/link (client nav + prefetch); root-relative
  // homepage anchors keep a plain <a> so the browser handles in-page scroll.
  const isRoute = item.href.startsWith('/') && !item.href.includes('#')
  return (
    <NavigationMenuLink asChild>
      {isRoute ? (
        <Link href={item.href} className={featureLinkCls}>
          <FeatureLinkBody item={item} />
        </Link>
      ) : (
        <a href={item.href} className={featureLinkCls}>
          <FeatureLinkBody item={item} />
        </a>
      )}
    </NavigationMenuLink>
  )
}

/** Desktop menu item for marketing pages — resolves against publishedRoutes. */
function MarketingNavLink({
  item,
  publishedRoutes,
}: {
  item: MarketingNavItem
  publishedRoutes: readonly string[]
}) {
  const resolved = resolveNavHref(item, publishedRoutes)
  const withIcon = {
    title: item.label,
    desc: item.desc,
    icon: NAV_ICONS[item.route],
  }

  if (resolved.type === 'coming-soon') {
    return (
      <div
        aria-disabled="true"
        className={cn(
          featureLinkCls,
          'cursor-default opacity-60 hover:bg-transparent'
        )}
      >
        <FeatureLinkBody item={withIcon} comingSoon />
      </div>
    )
  }
  return (
    <NavigationMenuLink asChild>
      {resolved.type === 'route' ? (
        <Link href={resolved.href} className={featureLinkCls}>
          <FeatureLinkBody item={withIcon} />
        </Link>
      ) : (
        <a href={resolved.href} className={featureLinkCls}>
          <FeatureLinkBody item={withIcon} />
        </a>
      )}
    </NavigationMenuLink>
  )
}

function MobileSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-3 text-base font-medium"
      >
        {title}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-3 pl-3">{children}</div>}
    </div>
  )
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      {children}
    </Link>
  )
}

/** Mobile list item for marketing pages — same resolution as desktop. */
function MobileMarketingLink({
  item,
  publishedRoutes,
  onClick,
}: {
  item: MarketingNavItem
  publishedRoutes: readonly string[]
  onClick: () => void
}) {
  const resolved = resolveNavHref(item, publishedRoutes)
  if (resolved.type === 'coming-soon') {
    return (
      <span
        aria-disabled="true"
        className="block rounded-lg px-3 py-2 text-sm text-muted-foreground/60"
      >
        {item.label}
        <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Kommer snart
        </span>
      </span>
    )
  }
  return (
    <MobileLink href={resolved.href} onClick={onClick}>
      {item.label}
    </MobileLink>
  )
}

export function NavbarV3({
  publishedRoutes = [],
}: {
  /** routes with live MDX pages — computed server-side via
   *  getPublishedMarketingRoutes(); default [] keeps items in fallback /
   *  "Kommer snart" state for render sites that don't pass it */
  publishedRoutes?: string[]
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasScrolled, setHasScrolled] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setIsOpen(false)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl transition-all duration-300',
        // Always frosted — only the bottom hairline fades in on scroll, so the
        // hero never bleeds up through the trigger row.
        hasScrolled
          ? 'border-b border-border/40'
          : 'border-b border-transparent'
      )}
    >
      <nav className="container mx-auto flex h-16 items-center justify-between px-4 md:h-[72px]">
        <Link href="/" className="ml-2 transition-opacity hover:opacity-90">
          <Image
            src="/images/logo-final.png"
            alt="Laglig.se"
            width={176}
            height={67}
            className="my-2 h-6 w-auto invert dark:invert-0 md:h-8"
            priority
          />
        </Link>

        {mounted ? (
          <NavigationMenu
            className="hidden md:flex"
            viewportClassName={cn(
              // Solid surface — fully opaque so menu text is always legible
              // (no hero bleed-through behind the card).
              'rounded-2xl border-border/50 bg-background',
              // Layered depth shadow (Linear/HubSpot float) + top-edge light catch.
              'shadow-[0_2px_4px_-1px_rgb(0_0_0/0.04),0_12px_28px_-8px_rgb(0_0_0/0.12),0_40px_80px_-24px_rgb(0_0_0/0.18)]',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent'
            )}
          >
            <NavigationMenuList>
              {/* Produkt — mega menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className={triggerCls}>
                  Produkt
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[800px] grid-cols-[1.7fr_1fr]">
                    <div className="p-3">
                      <p className="px-2.5 pb-2.5 pt-1 font-safiro text-[13px] font-medium tracking-tight text-amber-700">
                        Funktioner
                      </p>
                      <ul className="grid grid-cols-2 gap-0.5">
                        {FUNKTIONER_NAV.map((item) => (
                          <li key={item.label}>
                            <MarketingNavLink
                              item={item}
                              publishedRoutes={publishedRoutes}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-l border-border/60 bg-muted/30 p-3">
                      <p className="px-2.5 pb-2.5 pt-1 font-safiro text-[13px] font-medium tracking-tight text-amber-700">
                        Mer
                      </p>
                      <ul className="space-y-0.5">
                        {PRODUKT_MORE.map((item) => (
                          <li key={item.title}>
                            <NavigationMenuLink asChild>
                              <a
                                href={item.href}
                                className="block rounded-lg px-2.5 py-2 font-safiro text-sm font-medium tracking-tight text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                              >
                                {item.title}
                              </a>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Branscher — mega menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className={triggerCls}>
                  Branscher
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-[720px] p-3">
                    <p className="px-2.5 pb-2.5 pt-1 font-safiro text-[13px] font-medium tracking-tight text-amber-700">
                      Hitta reglerna för din bransch
                    </p>
                    <ul className="grid grid-cols-2 gap-1">
                      {BRANSCHER_NAV.map((item) => (
                        <li key={item.label}>
                          <MarketingNavLink
                            item={item}
                            publishedRoutes={publishedRoutes}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Områden — mega menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className={triggerCls}>
                  Områden
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-[720px] p-3">
                    <p className="px-2.5 pb-2.5 pt-1 font-safiro text-[13px] font-medium tracking-tight text-amber-700">
                      Regelområden att ha koll på
                    </p>
                    <ul className="grid grid-cols-2 gap-1">
                      {OMRADEN_NAV.map((item) => (
                        <li key={item.label}>
                          <MarketingNavLink
                            item={item}
                            publishedRoutes={publishedRoutes}
                          />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 border-t border-border/60 pt-2">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/omraden"
                          className="flex items-center justify-between rounded-lg px-2.5 py-2 font-safiro text-sm font-medium tracking-tight text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                        >
                          Visa alla områden
                          <span aria-hidden>→</span>
                        </Link>
                      </NavigationMenuLink>
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Regelverk — dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className={triggerCls}>
                  Regelverk
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[440px] gap-1 p-3">
                    {REGELVERK.map((item) => (
                      <li key={item.title}>
                        <FeatureLink item={item} />
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Priser */}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/#pricing"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    Priser
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        ) : (
          <div className="hidden md:flex md:h-9" />
        )}

        <div className="hidden md:flex md:items-center md:gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-foreground/[0.04] hover:text-foreground"
          >
            Logga in
          </Link>
          <Button
            asChild
            className="h-9 rounded-full bg-foreground px-5 text-sm font-medium text-background shadow-none transition-all duration-200 hover:bg-foreground/90 hover:shadow-md"
          >
            <Link href="/signup">Kom igång</Link>
          </Button>
        </div>

        {mounted ? (
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Öppna meny</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] overflow-y-auto sm:w-[340px]"
            >
              <SheetHeader>
                <SheetTitle className="ml-2">
                  <Image
                    src="/images/logo-final.png"
                    alt="Laglig.se"
                    width={144}
                    height={55}
                    className="my-2 h-6 w-auto invert dark:invert-0"
                  />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-8 flex flex-col">
                <MobileSection title="Produkt">
                  {FUNKTIONER_NAV.map((i) => (
                    <MobileMarketingLink
                      key={i.label}
                      item={i}
                      publishedRoutes={publishedRoutes}
                      onClick={close}
                    />
                  ))}
                  {PRODUKT_MORE.map((i) => (
                    <MobileLink key={i.title} href={i.href} onClick={close}>
                      {i.title}
                    </MobileLink>
                  ))}
                </MobileSection>
                <MobileSection title="Branscher">
                  {BRANSCHER_NAV.map((i) => (
                    <MobileMarketingLink
                      key={i.label}
                      item={i}
                      publishedRoutes={publishedRoutes}
                      onClick={close}
                    />
                  ))}
                </MobileSection>
                <MobileSection title="Områden">
                  {OMRADEN_NAV.map((i) => (
                    <MobileMarketingLink
                      key={i.label}
                      item={i}
                      publishedRoutes={publishedRoutes}
                      onClick={close}
                    />
                  ))}
                  <MobileLink href="/omraden" onClick={close}>
                    Visa alla områden →
                  </MobileLink>
                </MobileSection>
                <MobileSection title="Regelverk">
                  {REGELVERK.map((i) => (
                    <MobileLink key={i.title} href={i.href} onClick={close}>
                      {i.title}
                    </MobileLink>
                  ))}
                </MobileSection>
                <Link
                  href="/#pricing"
                  onClick={close}
                  className="border-b border-border/50 px-3 py-3 text-base font-medium"
                >
                  Priser
                </Link>

                <div className="mt-6 flex flex-col gap-3 px-3">
                  <Button
                    variant="outline"
                    asChild
                    className="h-11 w-full rounded-full"
                  >
                    <Link href="/login" onClick={close}>
                      Logga in
                    </Link>
                  </Button>
                  <Button
                    asChild
                    className="h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Link href="/signup" onClick={close}>
                      Kom igång
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <div className="h-9 w-9 md:hidden" />
        )}
      </nav>
    </header>
  )
}

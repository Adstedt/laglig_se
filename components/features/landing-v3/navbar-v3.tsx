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
  FileText,
  ClipboardCheck,
  Sparkles,
  BookOpen,
  Globe,
  Search,
  UtensilsCrossed,
  HardHat,
  HeartPulse,
  Factory,
  Truck,
  ShoppingCart,
  Cpu,
  Building2,
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

// ── Mega-menu content ───────────────────────────────────────────────────────
// Produkt + Branscher are built as mega-menu shells. Feature/industry items use
// landing anchors for now; swap the hrefs to dedicated pages (/funktioner/…,
// /branscher/…) once those are built.

type MenuLink = {
  href: string
  title: string
  desc?: string
  icon?: LucideIcon
}

const PRODUKT_FEATURES: MenuLink[] = [
  {
    href: '#how-it-works',
    title: 'Efterlevnad',
    desc: 'Laglista & krav på ett ställe',
    icon: Scale,
  },
  {
    href: '#how-it-works',
    title: 'Lagändringar',
    desc: 'AI bedömer varje ändring',
    icon: Bell,
  },
  {
    href: '#how-it-works',
    title: 'Uppgifter',
    desc: 'Åtgärder med ansvar & datum',
    icon: ListChecks,
  },
  {
    href: '#how-it-works',
    title: 'Styrdokument',
    desc: 'Policyer kopplade till krav',
    icon: FileText,
  },
  {
    href: '#how-it-works',
    title: 'Kontroll',
    desc: 'Bevisa efterlevnad',
    icon: ClipboardCheck,
  },
  {
    href: '#ai',
    title: 'AI-agenten',
    desc: 'Gör jobbet — ni godkänner',
    icon: Sparkles,
  },
]

const PRODUKT_MORE: MenuLink[] = [
  { href: '#how-it-works', title: 'Så fungerar det' },
  { href: '#skala', title: 'För hela företaget' },
  { href: '#pricing', title: 'Priser' },
  { href: '#faq', title: 'Vanliga frågor' },
]

// TODO: point each to /branscher/<slug> when industry pages exist.
const BRANSCHER: MenuLink[] = [
  { href: '#testa', title: 'Restaurang & hotell', icon: UtensilsCrossed },
  { href: '#testa', title: 'Bygg & anläggning', icon: HardHat },
  { href: '#testa', title: 'Vård & omsorg', icon: HeartPulse },
  { href: '#testa', title: 'Industri & tillverkning', icon: Factory },
  { href: '#testa', title: 'Transport & logistik', icon: Truck },
  { href: '#testa', title: 'Handel & e-handel', icon: ShoppingCart },
  { href: '#testa', title: 'IT & tech', icon: Cpu },
  { href: '#testa', title: 'Fastighet', icon: Building2 },
]

const REGELVERK: MenuLink[] = [
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

function FeatureLink({ item }: { item: MenuLink }) {
  return (
    <NavigationMenuLink asChild>
      <a
        href={item.href}
        className="group/item flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent"
      >
        {item.icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground/60 transition-colors group-hover/item:text-foreground">
            <item.icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-none">
            {item.title}
          </span>
          {item.desc && (
            <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground">
              {item.desc}
            </span>
          )}
        </span>
      </a>
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

export function NavbarV3() {
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
        'sticky top-0 z-50 w-full transition-all duration-300',
        hasScrolled
          ? 'border-b border-border/40 bg-background/80 backdrop-blur-xl'
          : 'bg-transparent'
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
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {/* Produkt — mega menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className={triggerCls}>
                  Produkt
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[640px] grid-cols-[1.5fr_1fr]">
                    <div className="p-3">
                      <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Funktioner
                      </p>
                      <ul className="grid grid-cols-2 gap-0.5">
                        {PRODUKT_FEATURES.map((item) => (
                          <li key={item.title}>
                            <FeatureLink item={item} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-l border-border/60 bg-muted/30 p-3">
                      <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Mer
                      </p>
                      <ul className="space-y-0.5">
                        {PRODUKT_MORE.map((item) => (
                          <li key={item.title}>
                            <NavigationMenuLink asChild>
                              <a
                                href={item.href}
                                className="block rounded-lg px-2.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
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
                  <div className="w-[560px] p-3">
                    <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Hitta reglerna för din bransch
                    </p>
                    <ul className="grid grid-cols-2 gap-0.5">
                      {BRANSCHER.map((item) => (
                        <li key={item.title}>
                          <FeatureLink item={item} />
                        </li>
                      ))}
                    </ul>
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
                    href="#pricing"
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
                  {[...PRODUKT_FEATURES, ...PRODUKT_MORE].map((i) => (
                    <MobileLink key={i.title} href={i.href} onClick={close}>
                      {i.title}
                    </MobileLink>
                  ))}
                </MobileSection>
                <MobileSection title="Branscher">
                  {BRANSCHER.map((i) => (
                    <MobileLink key={i.title} href={i.href} onClick={close}>
                      {i.title}
                    </MobileLink>
                  ))}
                </MobileSection>
                <MobileSection title="Regelverk">
                  {REGELVERK.map((i) => (
                    <MobileLink key={i.title} href={i.href} onClick={close}>
                      {i.title}
                    </MobileLink>
                  ))}
                </MobileSection>
                <Link
                  href="#pricing"
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

'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Menu,
  Scale,
  BookOpen,
  Gavel,
  Globe,
  FileText,
  Sparkles,
  HelpCircle,
  Newspaper,
  BookMarked,
  ChevronDown,
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

// Menu item component for dropdown content
const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & {
    icon?: React.ReactNode
    disabled?: boolean
  }
>(({ className, title, children, icon, disabled, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none rounded-lg p-3 leading-none no-underline outline-none transition-colors',
            disabled
              ? 'pointer-events-none opacity-50'
              : 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                {icon}
              </div>
            )}
            <div>
              <div className="text-sm font-medium leading-none">{title}</div>
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                {children}
              </p>
            </div>
          </div>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = 'ListItem'

// Mobile accordion item for dropdowns
function MobileNavSection({
  title,
  children,
  onNavigate,
}: {
  title: string
  children: React.ReactNode
  onNavigate: () => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-3 text-base font-medium"
      >
        {title}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen && (
        <div
          className="pb-3 pl-3"
          onClick={onNavigate}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate?.()}
          role="menu"
          tabIndex={0}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasScrolled, setHasScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        {/* Logo - placeholder until new logo arrives */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-70"
        >
          <Scale className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">
            Laglig.se
          </span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {/* Lagar dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9 rounded-full bg-transparent px-4 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[state=open]:bg-foreground/[0.04]">
                Lagar
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-1 p-3">
                  <ListItem
                    href="/lagar"
                    title="Svenska lagar"
                    icon={<BookOpen className="h-4 w-4" />}
                  >
                    Utforska alla svenska lagar och förordningar
                  </ListItem>
                  <ListItem
                    href="/rattsfall"
                    title="Rättsfall"
                    icon={<Gavel className="h-4 w-4" />}
                    disabled
                  >
                    Sök i domar från svenska domstolar
                  </ListItem>
                  <ListItem
                    href="/eu"
                    title="EU-direktiv"
                    icon={<Globe className="h-4 w-4" />}
                    disabled
                  >
                    EU-lagstiftning som påverkar Sverige
                  </ListItem>
                  <ListItem
                    href="/foreskrifter"
                    title="Föreskrifter"
                    icon={<FileText className="h-4 w-4" />}
                    disabled
                  >
                    Myndigheters föreskrifter och allmänna råd
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Produkt dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9 rounded-full bg-transparent px-4 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[state=open]:bg-foreground/[0.04]">
                Produkt
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-1 p-3">
                  <ListItem
                    href="#how-it-works"
                    title="Så fungerar det"
                    icon={<Sparkles className="h-4 w-4" />}
                  >
                    Kom igång på under 3 minuter
                  </ListItem>
                  <ListItem
                    href="#faq"
                    title="Vanliga frågor"
                    icon={<HelpCircle className="h-4 w-4" />}
                  >
                    Svar på de vanligaste frågorna
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Priser - enkel länk */}
            <NavigationMenuItem>
              <Link href="#pricing" legacyBehavior passHref>
                <NavigationMenuLink className="inline-flex h-9 items-center justify-center rounded-full bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
                  Priser
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>

            {/* Resurser dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9 rounded-full bg-transparent px-4 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[state=open]:bg-foreground/[0.04]">
                Resurser
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-1 p-3">
                  <ListItem
                    href="/blogg"
                    title="Blogg"
                    icon={<Newspaper className="h-4 w-4" />}
                    disabled
                  >
                    Artiklar om lagefterlevnad och compliance
                  </ListItem>
                  <ListItem
                    href="/guider"
                    title="Guider"
                    icon={<BookMarked className="h-4 w-4" />}
                    disabled
                  >
                    Djupgående guider för olika branscher
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop Auth */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <Link
            href="/login"
            className={cn(
              'rounded-full px-4 py-2 text-sm text-muted-foreground',
              'transition-all duration-200',
              'hover:bg-foreground/[0.04] hover:text-foreground'
            )}
          >
            Logga in
          </Link>
          <Button
            asChild
            className={cn(
              'h-9 rounded-full px-5 text-sm font-medium',
              'bg-foreground text-background',
              'shadow-none transition-all duration-200',
              'hover:bg-foreground/90 hover:shadow-md'
            )}
          >
            <Link href="/signup">Kom igång</Link>
          </Button>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full md:hidden"
              data-testid="mobile-menu-trigger"
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
              <SheetTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                <span className="font-semibold tracking-tight">Laglig.se</span>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-8 flex flex-col">
              {/* Lagar */}
              <MobileNavSection
                title="Lagar"
                onNavigate={() => setIsOpen(false)}
              >
                <Link
                  href="/lagar"
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Svenska lagar
                </Link>
                <span className="block rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
                  Rättsfall (kommer snart)
                </span>
                <span className="block rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
                  EU-direktiv (kommer snart)
                </span>
              </MobileNavSection>

              {/* Produkt */}
              <MobileNavSection
                title="Produkt"
                onNavigate={() => setIsOpen(false)}
              >
                <Link
                  href="#how-it-works"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Så fungerar det
                </Link>
                <Link
                  href="#faq"
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Vanliga frågor
                </Link>
              </MobileNavSection>

              {/* Priser */}
              <Link
                href="#pricing"
                onClick={() => setIsOpen(false)}
                className="border-b border-border/50 px-3 py-3 text-base font-medium"
              >
                Priser
              </Link>

              {/* Resurser */}
              <MobileNavSection
                title="Resurser"
                onNavigate={() => setIsOpen(false)}
              >
                <span className="block rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
                  Blogg (kommer snart)
                </span>
                <span className="block rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
                  Guider (kommer snart)
                </span>
              </MobileNavSection>

              {/* Auth buttons */}
              <div className="mt-6 flex flex-col gap-3 px-3">
                <Button
                  variant="outline"
                  asChild
                  className="h-11 w-full rounded-full"
                >
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    Logga in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <Link href="/signup" onClick={() => setIsOpen(false)}>
                    Kom igång
                  </Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}

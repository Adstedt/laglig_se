'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Menu,
  BookOpen,
  Globe,
  FileText,
  Sparkles,
  HelpCircle,
  Search,
  Gavel,
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

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & {
    icon?: React.ReactNode
  }
>(({ className, title, children, icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none rounded-lg p-3 leading-none no-underline outline-none transition-colors',
            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
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

export function NavbarV2() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasScrolled, setHasScrolled] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

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
        <Link href="/" className="ml-2 transition-opacity hover:opacity-90">
          <Image
            src="/images/logo-final.png"
            alt="Laglig.se"
            width={176}
            height={67}
            className="my-2 h-6 md:h-8 w-auto invert dark:invert-0"
            priority
          />
        </Link>

        {mounted ? (
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {/* Regelverk — now points to dedicated SEO routes */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="h-9 rounded-full bg-transparent px-4 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground data-[state=open]:bg-foreground/[0.04]">
                  Regelverk
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[440px] gap-1 p-3">
                    <ListItem
                      href="/lagar"
                      title="Svenska lagar"
                      icon={<BookOpen className="h-4 w-4" />}
                    >
                      Alla lagar och förordningar – fria att läsa
                    </ListItem>
                    <ListItem
                      href="/foreskrifter"
                      title="Föreskrifter"
                      icon={<FileText className="h-4 w-4" />}
                    >
                      Regler från myndigheter, t.ex. AFS och MSBFS
                    </ListItem>
                    <ListItem
                      href="/eu"
                      title="EU-regler"
                      icon={<Globe className="h-4 w-4" />}
                    >
                      EU-förordningar och direktiv som gäller i Sverige
                    </ListItem>
                    <ListItem
                      href="/rattskallor"
                      title="Domar & praxis"
                      icon={<Gavel className="h-4 w-4" />}
                    >
                      Rättsfall och vägledning för hur reglerna tolkas
                    </ListItem>
                    <ListItem
                      href="/sok"
                      title="Sök i lagboken"
                      icon={<Search className="h-4 w-4" />}
                    >
                      Sök fritt i alla lagar och regler
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

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
                <MobileNavSection
                  title="Regelverk"
                  onNavigate={() => setIsOpen(false)}
                >
                  <Link
                    href="/lagar"
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Svenska lagar
                  </Link>
                  <Link
                    href="/foreskrifter"
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Föreskrifter
                  </Link>
                  <Link
                    href="/eu"
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    EU-regler
                  </Link>
                  <Link
                    href="/rattskallor"
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Domar & praxis
                  </Link>
                  <Link
                    href="/sok"
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Sök i lagboken
                  </Link>
                </MobileNavSection>

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

                <Link
                  href="#pricing"
                  onClick={() => setIsOpen(false)}
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
        ) : (
          <div className="h-9 w-9 md:hidden" />
        )}
      </nav>
    </header>
  )
}

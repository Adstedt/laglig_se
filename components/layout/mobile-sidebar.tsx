'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Scale,
  BookOpen,
  CheckSquare,
  Users,
  Bell,
  Settings,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useLayoutStore } from '@/lib/stores/layout-store'
import { useState } from 'react'

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

const platformItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'AI Chat',
    icon: MessageSquare,
    href: '#',
    isToggle: true,
  },
  {
    title: 'Laglistor',
    icon: Scale,
    href: '#',
    isAccordion: true,
    subItems: [
      { title: 'Mina laglistor', href: '/laglistor' },
      { title: 'Alla lagar', href: '/rattskallor' },
    ],
  },
  {
    title: 'Rättskällor',
    icon: BookOpen,
    href: '/rattskallor',
  },
  {
    title: 'Inställningar',
    icon: Settings,
    href: '/settings',
  },
]

const workItems = [
  {
    title: 'Uppgifter',
    icon: CheckSquare,
    href: '#',
    disabled: true,
  },
  {
    title: 'HR',
    icon: Users,
    href: '#',
    isAccordion: true,
    disabled: true,
    subItems: [
      { title: 'Anställda', href: '/hr/employees' },
      { title: 'Efterlevnad', href: '/hr/compliance' },
    ],
  },
  {
    title: 'Ändringsbevakning',
    icon: Bell,
    href: '#',
    disabled: true,
  },
]

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname()
  const { toggleRightSidebar } = useLayoutStore()
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    {}
  )

  const isActive = (href: string) => {
    if (href === '#') return false
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const toggleAccordion = (title: string) => {
    setOpenAccordions((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const handleLinkClick = () => {
    onOpenChange(false)
  }

  const handleAIChatToggle = () => {
    toggleRightSidebar()
    onOpenChange(false)
  }

  const renderNavItem = (
    item: (typeof platformItems)[0] & {
      isToggle?: boolean
      isAccordion?: boolean
      disabled?: boolean
      subItems?: { title: string; href: string }[]
    }
  ) => {
    const Icon = item.icon
    const active = isActive(item.href)

    // Toggle button for AI Chat
    if (item.isToggle) {
      return (
        <button
          key={item.title}
          onClick={handleAIChatToggle}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="flex-1 text-left">{item.title}</span>
        </button>
      )
    }

    // Accordion menu item
    if (item.isAccordion && item.subItems) {
      const isOpen = openAccordions[item.title] ?? false
      return (
        <div key={item.title}>
          <button
            onClick={() => !item.disabled && toggleAccordion(item.title)}
            disabled={item.disabled}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
              'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-90'
              )}
            />
          </button>
          {isOpen && !item.disabled && (
            <div className="ml-8 mt-1 space-y-1 border-l border-border pl-3">
              {item.subItems.map((subItem) => (
                <Link
                  key={subItem.title}
                  href={subItem.href}
                  onClick={handleLinkClick}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive(subItem.href)
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {subItem.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Regular menu item
    if (item.disabled) {
      return (
        <span
          key={item.title}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
            'opacity-50 cursor-not-allowed text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
          <span>{item.title}</span>
        </span>
      )
    }

    return (
      <Link
        key={item.title}
        href={item.href}
        onClick={handleLinkClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}>
              Laglig.se
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-65px)]">
          {/* Workspace Selector */}
          <div className="p-3 border-b">
            <button className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Min arbetsplats</p>
                <p className="text-xs text-muted-foreground truncate">
                  Provperiod
                </p>
              </div>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            {/* Platform Section */}
            <div>
              <h3 className="mb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Plattform
              </h3>
              <div className="space-y-1">
                {platformItems.map(renderNavItem)}
              </div>
            </div>

            {/* Work Section */}
            <div className="mt-6">
              <h3 className="mb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Arbete
              </h3>
              <div className="space-y-1">{workItems.map(renderNavItem)}</div>
            </div>
          </nav>

          {/* Trial Status at bottom */}
          <div className="border-t p-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Provperiod</span>
                <span className="text-xs font-medium text-primary">
                  14 dagar
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

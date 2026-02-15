'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  MessageSquare,
  Scale,
  BookOpen,
  CheckSquare,
  FolderOpen,
  Users,
  Bell,
  Settings,
  ChevronRight,
  LogOut,
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
import { WorkspaceSwitcher } from './workspace-switcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

// Nav items without Inställningar (pinned to bottom)
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
    title: 'Efterlevnad',
    icon: Scale,
    href: '#',
    isAccordion: true,
    subItems: [
      { title: 'Mina listor', href: '/laglistor' },
      { title: 'Mallar', href: '/laglistor/mallar' },
    ],
  },
  {
    title: 'Regelverk',
    icon: BookOpen,
    href: '#',
    isAccordion: true,
    subItems: [
      { title: 'Bläddra alla', href: '/browse/rattskallor' },
      { title: 'Svenska lagar', href: '/browse/lagar' },
      { title: 'Rättsfall', href: '/browse/rattsfall' },
      { title: 'EU-rätt', href: '/browse/eu' },
    ],
  },
]

const workItems = [
  {
    title: 'Uppgifter',
    icon: CheckSquare,
    href: '/tasks',
  },
  {
    title: 'Mina filer',
    icon: FolderOpen,
    href: '/documents',
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

export function MobileSidebar({
  open,
  onOpenChange,
  user,
}: MobileSidebarProps) {
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

  // User initials for avatar
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

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
            <Link href="/dashboard" onClick={handleLinkClick}>
              <Image
                src="/images/logo-final.png"
                alt="Laglig.se"
                width={120}
                height={46}
                className="h-6 w-auto invert dark:invert-0"
              />
            </Link>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100%-65px)]">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            {/* Platform Section */}
            <div>
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

          {/* Bottom section */}
          <div className="border-t p-3 space-y-2">
            {/* Inställningar */}
            <Link
              href="/settings"
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Inställningar</span>
            </Link>

            <Separator />

            {/* Workspace Switcher */}
            <WorkspaceSwitcher onSwitchComplete={() => onOpenChange(false)} />

            {/* User row */}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={user?.image || undefined}
                  alt={user?.name || 'User'}
                />
                <AvatarFallback className="text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">
                  {user?.name || 'Användare'}
                </p>
              </div>
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

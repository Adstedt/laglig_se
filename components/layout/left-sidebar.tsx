'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home,
  MessageSquare,
  Scale,
  BookOpen,
  CheckSquare,
  FolderOpen,
  Users,
  Bell,
  Settings,
  ChevronRight,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { useLayoutStore } from '@/lib/stores/layout-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useState, useRef, useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { getUnacknowledgedChangeCount } from '@/app/actions/change-events'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface LeftSidebarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

interface NavItem {
  title: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  isToggle?: boolean
  isAccordion?: boolean
  disabled?: boolean
  lockedReason?: string
  subItems?: { title: string; href: string }[]
}

// Main nav items (without Inställningar — that's pinned to bottom)
const platformItems: NavItem[] = [
  {
    title: 'Hem',
    icon: Home,
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
      { title: 'Ändringar', href: '/laglistor?tab=changes' },
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

const workItems: NavItem[] = [
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

/** Collapsed accordion item — manages tooltip/popover state so they don't overlap */
function CollapsedAccordionItem({
  item,
  isActive,
  changeCount = 0,
}: {
  item: NavItem
  isActive: (_href: string) => boolean
  changeCount?: number
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const suppressUntil = useRef(0)
  const Icon = item.icon

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open)
        if (open) setTooltipOpen(false)
      }}
    >
      <Tooltip
        open={popoverOpen ? false : tooltipOpen}
        onOpenChange={(open) => {
          if (open && Date.now() < suppressUntil.current) return
          setTooltipOpen(open)
        }}
      >
        <TooltipTrigger asChild>
          <span className="block">
            <PopoverTrigger asChild>
              <button
                disabled={item.disabled}
                className={cn(
                  'relative flex w-full items-center justify-center rounded-lg p-2 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  item.disabled ? 'opacity-50 cursor-not-allowed' : '',
                  'text-foreground/60 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title === 'Efterlevnad' && changeCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          {item.title}
        </TooltipContent>
      </Tooltip>
      {!item.disabled && item.subItems && (
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-48 p-1.5 shadow-lg"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-foreground/70 uppercase tracking-wider">
            {item.title}
          </div>
          <div className="space-y-0.5">
            {item.subItems.map((subItem) => (
              <Link
                key={subItem.href}
                href={subItem.href}
                prefetch={true}
                onClick={() => {
                  setPopoverOpen(false)
                  setTooltipOpen(false)
                  suppressUntil.current = Date.now() + 500
                }}
                className={cn(
                  'flex items-center rounded-md px-2 py-1.5 text-sm transition-colors',
                  isActive(subItem.href)
                    ? 'text-foreground font-medium bg-accent'
                    : 'text-foreground/70 hover:text-foreground hover:bg-accent'
                )}
              >
                {subItem.title}
                {subItem.href.includes('tab=changes') && changeCount > 0 && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                )}
              </Link>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}

export function LeftSidebar({ user }: LeftSidebarProps) {
  const pathname = usePathname()
  const { toggleRightSidebar, leftSidebarCollapsed, toggleLeftSidebar } =
    useLayoutStore()
  const { can, isLoading } = usePermissions()
  const searchParams = useSearchParams()
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    {}
  )
  const [changeCount, setChangeCount] = useState(0)

  // Prevent hydration mismatch: Zustand persist rehydrates from localStorage
  // before first render, which can produce a different Radix component tree
  // (collapsed renders Tooltip/Popover wrappers, expanded doesn't). Defer to
  // the default (expanded) until after hydration completes.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    async function fetchCount() {
      const result = await getUnacknowledgedChangeCount()
      if (result.success && result.data !== undefined) {
        setChangeCount(result.data)
      }
    }
    fetchCount()
  }, [])

  const collapsed = mounted ? leftSidebarCollapsed : false

  // Permission-gated work items
  const permissionGatedWorkItems: NavItem[] = workItems.map((item): NavItem => {
    if (item.title === 'HR') {
      const hasPermission = !isLoading && can.viewEmployees
      if (hasPermission) {
        return { ...item, disabled: false }
      }
      return { ...item, disabled: true, lockedReason: 'Kräver HR-behörighet' }
    }
    return item
  })

  const isActive = (href: string) => {
    if (href === '#') return false
    // Handle hrefs with query params (e.g., /laglistor?tab=changes)
    if (href.includes('?')) {
      const [path, query] = href.split('?')
      if (pathname !== path) return false
      const params = new URLSearchParams(query)
      for (const [key, value] of params) {
        if (searchParams.get(key) !== value) return false
      }
      return true
    }
    if (href === '/dashboard') return pathname === href
    // /laglistor is only active when not on ?tab=changes
    if (href === '/laglistor') {
      return pathname === '/laglistor' && searchParams.get('tab') !== 'changes'
    }
    return pathname.startsWith(href)
  }

  const toggleAccordion = (title: string) => {
    setOpenAccordions((prev) => ({ ...prev, [title]: !prev[title] }))
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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.href)

    // Toggle button for AI Chat
    if (item.isToggle) {
      if (collapsed) {
        return (
          <Tooltip key={item.title}>
            <TooltipTrigger asChild>
              <button
                onClick={toggleRightSidebar}
                className={cn(
                  'flex w-full items-center justify-center rounded-lg p-2 text-sm transition-colors',
                  'hover:bg-accent hover:text-foreground',
                  'text-foreground/60'
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              {item.title}
            </TooltipContent>
          </Tooltip>
        )
      }
      return (
        <button
          key={item.title}
          onClick={toggleRightSidebar}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            'hover:bg-accent hover:text-foreground',
            'text-foreground/60'
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{item.title}</span>
        </button>
      )
    }

    // Accordion menu item
    if (item.isAccordion && item.subItems) {
      // Collapsed: use dedicated component with proper tooltip/popover management
      if (collapsed) {
        return (
          <CollapsedAccordionItem
            key={item.title}
            item={item}
            isActive={isActive}
            changeCount={changeCount}
          />
        )
      }

      // Expanded: accordion behavior
      const isOpen = openAccordions[item.title] ?? false
      return (
        <div key={item.title}>
          <button
            onClick={() => !item.disabled && toggleAccordion(item.title)}
            disabled={item.disabled}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              'hover:bg-accent hover:text-foreground',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
              'text-foreground/60'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{item.title}</span>
            {item.title === 'Efterlevnad' && changeCount > 0 && !isOpen && (
              <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
            )}
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-90'
              )}
            />
          </button>
          {isOpen && !item.disabled && (
            <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-3">
              {item.subItems.map((subItem) => (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  prefetch={true}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive(subItem.href)
                      ? 'text-foreground font-medium bg-accent'
                      : 'text-foreground/60 hover:text-foreground'
                  )}
                >
                  <span className="truncate">{subItem.title}</span>
                  {subItem.href.includes('tab=changes') && changeCount > 0 && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Regular disabled item
    if (item.disabled) {
      if (collapsed) {
        return (
          <Tooltip key={item.title}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'flex items-center justify-center rounded-lg p-2 text-sm',
                  'opacity-40 cursor-not-allowed text-foreground/60'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              {item.title}
              {item.lockedReason && ` — ${item.lockedReason}`}
            </TooltipContent>
          </Tooltip>
        )
      }
      return (
        <span
          key={item.title}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
            'opacity-40 cursor-not-allowed text-foreground/60'
          )}
          title={item.lockedReason}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.lockedReason && <Lock className="h-3 w-3" />}
        </span>
      )
    }

    // Regular link item
    if (collapsed) {
      return (
        <Tooltip key={item.title}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              prefetch={true}
              className={cn(
                'flex items-center justify-center rounded-lg p-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/60 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            {item.title}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        key={item.title}
        href={item.href}
        prefetch={true}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-accent text-foreground'
            : 'text-foreground/60 hover:bg-accent hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-r bg-background transition-all duration-200',
          'hidden md:flex',
          collapsed ? 'w-16' : 'w-[240px]'
        )}
      >
        {/* Logo + collapse toggle */}
        <div
          className={cn(
            'relative flex h-[60px] shrink-0 items-center',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Link href="/dashboard" className={collapsed ? '' : 'ml-2'}>
            {collapsed ? (
              <Image
                src="/images/logo-icon-white.png"
                alt="Laglig.se"
                width={24}
                height={28}
                className="h-7 w-auto invert dark:invert-0"
                priority
              />
            ) : (
              <Image
                src="/images/logo-final.png"
                alt="Laglig.se"
                width={160}
                height={62}
                className="h-7 w-auto invert dark:invert-0"
                priority
              />
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={toggleLeftSidebar}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          {/* Short centered separator — sits at bottom of 60px container, aligned with header border-b */}
          <div
            className={cn(
              'absolute bottom-0 h-px bg-border',
              collapsed ? 'left-2 right-2' : 'left-3 right-3'
            )}
          />
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto',
            collapsed ? 'px-2 py-3' : 'px-3 py-3'
          )}
        >
          {/* Platform Section — hide AI Chat toggle on /dashboard (Hem IS the chat) */}
          <div className="space-y-0.5">
            {platformItems
              .filter((item) => !(item.isToggle && pathname === '/dashboard'))
              .map(renderNavItem)}
          </div>

          {/* Work Section */}
          <div className="mt-6">
            {!collapsed && (
              <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
                Arbete
              </h3>
            )}
            {collapsed && <Separator className="mb-3" />}
            <div className="space-y-0.5">
              {permissionGatedWorkItems.map(renderNavItem)}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className={cn('border-t', collapsed ? 'px-2 py-2' : 'px-3 py-2')}>
          {/* Inställningar */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  prefetch={true}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-2 text-sm transition-colors',
                    pathname.startsWith('/settings')
                      ? 'bg-accent text-foreground'
                      : 'text-foreground/60 hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Settings className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                Inställningar
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              prefetch={true}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/60 hover:bg-accent hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4" />
              <span>Inställningar</span>
            </Link>
          )}

          {/* Workspace Switcher */}
          <div className={cn('mt-0.5', collapsed && 'flex justify-center')}>
            {collapsed ? (
              <WorkspaceSwitcher collapsed />
            ) : (
              <WorkspaceSwitcher />
            )}
          </div>

          {/* User avatar with dropdown menu */}
          <div className="mt-0.5">
            {collapsed ? (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-accent">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={user?.image || undefined}
                              alt={user?.name || 'User'}
                            />
                            <AvatarFallback className="text-xs">
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      </DropdownMenuTrigger>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    {user?.name || user?.email || 'Konto'}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name || 'Användare'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Inställningar</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logga ut</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-foreground/60 hover:bg-accent hover:text-foreground">
                    <Avatar className="h-7 w-7 shrink-0">
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
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name || 'Användare'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Inställningar</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logga ut</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Expand toggle — only when collapsed */}
          {collapsed && (
            <div className="mt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleLeftSidebar}
                    className="flex w-full items-center justify-center rounded-lg p-2 text-sm transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <PanelLeftOpen className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  Expandera sidofält
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

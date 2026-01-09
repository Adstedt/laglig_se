'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
  Lock,
  Star,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrialStatusWidget } from '@/components/layout/trial-status-widget'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { useLayoutStore } from '@/lib/stores/layout-store'
import { useDocumentListStore } from '@/lib/stores/document-list-store'
import { usePermissions } from '@/hooks/use-permissions'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useState, useEffect, useCallback, useRef } from 'react'

interface LeftSidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

interface NavItem {
  title: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  isToggle?: boolean
  isAccordion?: boolean
  isDynamicLists?: boolean // Story 4.13: Flag for dynamic list loading
  disabled?: boolean
  lockedReason?: string
  subItems?: { title: string; href: string; isDefault?: boolean }[]
}

// Story 4.13 Task 0: Base platform items (Laglistor will have dynamic subItems)
const getBasePlatformItems = (): NavItem[] => [
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
    isDynamicLists: true, // Story 4.13: Flag for dynamic list loading
    subItems: [{ title: 'Mina laglistor', href: '/laglistor' }],
  },
  {
    title: 'Rättskällor',
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
  {
    title: 'Inställningar',
    icon: Settings,
    href: '/settings',
  },
]

const workItems: NavItem[] = [
  {
    title: 'Uppgifter',
    icon: CheckSquare,
    href: '/tasks',
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

export function LeftSidebar({
  collapsed,
  onToggle: _onToggle,
}: LeftSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toggleRightSidebar } = useLayoutStore()
  const { can, isLoading } = usePermissions()
  const { workspaceId } = useWorkspace()
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    {}
  )

  // Story 4.14: Use Zustand store for lists - syncs with document list page
  const { lists: lawLists, isLoadingLists, fetchLists } = useDocumentListStore()
  const [listsLoaded, setListsLoaded] = useState(false)
  const prevWorkspaceIdRef = useRef(workspaceId)

  // Reset listsLoaded when workspace changes (so lists are refetched)
  useEffect(() => {
    if (
      prevWorkspaceIdRef.current &&
      workspaceId &&
      prevWorkspaceIdRef.current !== workspaceId
    ) {
      setListsLoaded(false)
    }
    prevWorkspaceIdRef.current = workspaceId
  }, [workspaceId])

  // Get active list ID from URL
  const activeListIdFromUrl = searchParams.get('list')

  // Memoize fetchLists to avoid re-renders
  const loadLists = useCallback(() => {
    if (!listsLoaded && !isLoadingLists) {
      fetchLists().then(() => setListsLoaded(true))
    }
  }, [listsLoaded, isLoadingLists, fetchLists])

  // Story 4.14: Fetch law lists when Laglistor accordion is opened (using store)
  useEffect(() => {
    if (openAccordions['Laglistor']) {
      loadLists()
    }
  }, [openAccordions, loadLists])

  // Build platform items with dynamic law lists
  // Story 4.13: Always show "Mina laglistor" first, then individual lists below
  const platformItems = getBasePlatformItems().map((item) => {
    if (item.isDynamicLists) {
      const baseItem = {
        title: 'Mina laglistor',
        href: '/laglistor',
        isDefault: false,
      }
      const listItems = lawLists.map((list) => ({
        title: list.name,
        href: `/laglistor?list=${list.id}`,
        isDefault: list.isDefault,
      }))
      return {
        ...item,
        subItems: [baseItem, ...listItems],
      }
    }
    return item
  })

  // Permission-gated work items
  const permissionGatedWorkItems: NavItem[] = workItems.map((item): NavItem => {
    // HR menu requires employees:view permission
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
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const toggleAccordion = (title: string) => {
    setOpenAccordions((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.href)

    // Toggle button for AI Chat
    if (item.isToggle) {
      return (
        <button
          key={item.title}
          onClick={toggleRightSidebar}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
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
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
              'text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{item.title}</span>
            {/* Story 4.13: Show loading indicator for dynamic lists */}
            {item.isDynamicLists && isLoadingLists && isOpen && (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            )}
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-90'
              )}
            />
          </button>
          {isOpen && !item.disabled && (
            <div className="ml-7 mt-1 space-y-1 border-l border-border pl-3">
              {item.subItems.map((subItem) => {
                // Story 4.13 Task 0: Check if this list is active based on URL param
                const isSpecificListLink = subItem.href.includes('?list=')
                const isListActive =
                  item.isDynamicLists &&
                  activeListIdFromUrl &&
                  subItem.href.includes(`list=${activeListIdFromUrl}`)

                // "Mina laglistor" (no ?list=) should only highlight when no list param in URL
                const isBaseListActive =
                  item.isDynamicLists &&
                  !isSpecificListLink &&
                  pathname === '/laglistor' &&
                  !activeListIdFromUrl

                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                      isListActive ||
                        isBaseListActive ||
                        (!item.isDynamicLists && isActive(subItem.href))
                        ? 'text-foreground font-medium bg-accent/50'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {/* Story 4.13: Show star for default list */}
                    {subItem.isDefault && (
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{subItem.title}</span>
                  </Link>
                )
              })}
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
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
            'opacity-50 cursor-not-allowed text-muted-foreground'
          )}
          title={item.lockedReason}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.lockedReason && <Lock className="h-3 w-3" />}
        </span>
      )
    }

    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        'flex h-full w-[240px] flex-col border-r bg-background transition-all duration-200',
        'hidden md:flex', // Hide on mobile, show on md+
        collapsed && 'md:w-0 md:overflow-hidden'
      )}
    >
      {/* Workspace Selector */}
      <div className="p-3">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        {/* Platform Section */}
        <div>
          <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
            Plattform
          </h3>
          <div className="space-y-0.5">{platformItems.map(renderNavItem)}</div>
        </div>

        {/* Work Section */}
        <div className="mt-6">
          <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
            Arbete
          </h3>
          <div className="space-y-0.5">
            {permissionGatedWorkItems.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* Trial Status at bottom */}
      <div className="border-t p-3">
        <TrialStatusWidget />
      </div>
    </aside>
  )
}

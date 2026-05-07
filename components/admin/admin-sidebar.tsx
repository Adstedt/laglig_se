'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  Gauge,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCatalogRequestPipCount } from '@/app/actions/catalog-ingest-request'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/usage', label: 'AI-användning', icon: Gauge },
  // Story 24.5 — catalog-requests admin queue. Pip count rendered separately
  // via SWR with 60s refresh.
  {
    href: '/admin/catalog-requests',
    label: 'Katalogtillägg',
    icon: Inbox,
    showPip: true,
  },
  { href: '/admin/cron-jobs', label: 'Cron Jobs', icon: Clock },
  { href: '/admin/cron-jobs/errors', label: 'Felloggar', icon: AlertTriangle },
] as const

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: pip } = useSWR(
    'admin-catalog-request-pip',
    async () => {
      const r = await getCatalogRequestPipCount()
      return r.success && r.data ? r.data : { pending: 0, breached: 0 }
    },
    { refreshInterval: 60_000, revalidateOnFocus: false }
  )

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/admin/dashboard">
          <Image
            src="/images/logo-final.png"
            alt="Laglig.se"
            width={160}
            height={62}
            className="h-7 w-auto invert"
            priority
          />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin/cron-jobs'
              ? pathname === '/admin/cron-jobs'
              : pathname.startsWith(item.href)
          const Icon = item.icon
          const showPip = 'showPip' in item && item.showPip
          const pipCount = showPip ? (pip?.pending ?? 0) : 0
          const pipBreached = showPip ? (pip?.breached ?? 0) > 0 : false
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {showPip && pipCount > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                    pipBreached
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  )}
                  data-testid="admin-catalog-request-pip"
                >
                  {pipCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

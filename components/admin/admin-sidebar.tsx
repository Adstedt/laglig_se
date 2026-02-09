'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/cron-jobs', label: 'Cron Jobs', icon: Clock },
  { href: '/admin/cron-jobs/errors', label: 'Felloggar', icon: AlertTriangle },
] as const

export function AdminSidebar() {
  const pathname = usePathname()

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
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

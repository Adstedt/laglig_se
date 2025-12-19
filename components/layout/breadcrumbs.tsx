'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'

// Route name mappings for Swedish labels
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  settings: 'Inställningar',
  workspace: 'Arbetsyta',
  billing: 'Fakturering',
  'ai-chat': 'AI Chat',
  kanban: 'Uppgifter',
  hr: 'HR',
  employees: 'Anställda',
  compliance: 'Efterlevnad',
  lagar: 'Lagar',
  rattskallor: 'Rättskällor',
}

export function Breadcrumbs() {
  const pathname = usePathname()

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean)

  // Don't show breadcrumbs on root dashboard
  if (
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === 'dashboard')
  ) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          // Skip dashboard since it's already shown
          if (segment === 'dashboard') return null

          const href = '/' + segments.slice(0, index + 1).join('/')
          const isLast = index === segments.length - 1
          const label = routeLabels[segment] || segment

          return (
            <Fragment key={segment}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

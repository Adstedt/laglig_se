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
import { useWorkspace } from '@/hooks/use-workspace'

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
  const { workspaceName } = useWorkspace()

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean)

  // Check if we're on the dashboard (root)
  const isDashboard =
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === 'dashboard')

  // Get the current page label
  const currentSegment = segments[segments.length - 1]
  const currentLabel = routeLabels[currentSegment || ''] || currentSegment

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="text-sm">
        {/* Workspace name as root */}
        <BreadcrumbItem>
          {isDashboard ? (
            <BreadcrumbPage>{workspaceName || 'Arbetsplats'}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/dashboard">{workspaceName || 'Arbetsplats'}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {/* Current page (only if not on dashboard) */}
        {!isDashboard && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

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
  tasks: 'Uppgifter',
  documents: 'Mina filer',
  hr: 'HR',
  employees: 'Anställda',
  compliance: 'Efterlevnad',
  laglistor: 'Mina laglistor',
  mallar: 'Mallbibliotek',
  browse: 'Rättskällor',
  lagar: 'Lagar',
  rattskallor: 'Bläddra',
  rattsfall: 'Rättsfall',
  eu: 'EU-rätt',
  // Law sub-routes
  historik: 'Ändringshistorik',
  version: 'Version',
  // Court codes
  hd: 'Högsta domstolen',
  hovr: 'Hovrätten',
  hfd: 'Högsta förvaltningsdomstolen',
  ad: 'Arbetsdomstolen',
  mod: 'Mark- och miljööverdomstolen',
  mig: 'Migrationsöverdomstolen',
  // EU types
  forordningar: 'Förordningar',
  direktiv: 'Direktiv',
}

// Segments that should be shown as intermediate links (not collapsed)
const showAsLink = new Set([
  'browse',
  'lagar',
  'rattsfall',
  'eu',
  'hd',
  'hovr',
  'hfd',
  'ad',
  'mod',
  'mig',
  'forordningar',
  'direktiv',
  'historik',
  'version',
])

// Get a user-friendly label for a segment (truncate long slugs)
function getSegmentLabel(segment: string): string {
  if (routeLabels[segment]) {
    return routeLabels[segment]
  }
  // For document slugs, show a truncated version
  if (segment.length > 30) {
    return segment.substring(0, 27) + '...'
  }
  return segment
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

  // Build breadcrumb items with proper hierarchy
  const breadcrumbItems: Array<{ label: string; href?: string }> = []

  if (!isDashboard) {
    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (!segment) continue

      currentPath += `/${segment}`
      const isLast = i === segments.length - 1

      // Skip 'browse' in the breadcrumb display but keep in path
      if (segment === 'browse') continue

      const label = getSegmentLabel(segment)

      if (isLast) {
        // Last segment is current page (no link)
        breadcrumbItems.push({ label })
      } else if (showAsLink.has(segment)) {
        // Known intermediate routes get links
        breadcrumbItems.push({ label, href: currentPath })
      }
      // Unknown intermediate segments (like dynamic IDs) are skipped
    }
  }

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

        {/* Intermediate and current pages */}
        {breadcrumbItems.map((item, index) => (
          <span key={index} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

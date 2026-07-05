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
import { useBreadcrumbOverrideStore } from '@/lib/stores/breadcrumb-override-store'

// Route name mappings for Swedish labels
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  settings: 'Inställningar',
  workspace: 'Arbetsyta',
  activity: 'Aktivitetslogg',
  billing: 'Fakturering',
  'ai-chat': 'AI Chat',
  kanban: 'Uppgifter',
  tasks: 'Uppgifter',
  styrdokument: 'Styrdokument',
  filer: 'Filer',
  hr: 'HR',
  employees: 'Anställda',
  personalregister: 'Personalregister',
  compliance: 'Efterlevnad',
  laglistor: 'Laglistor',
  krav: 'Krav',
  mallar: 'Mallar',
  // Story 21.4 + 21.5.2: lagefterlevnadskontroll module.
  kontroller: 'Kontroller',
  skapa: 'Skapa kontroll',
  browse: 'Regelverk',
  lagar: 'Lagar',
  rattskallor: 'Bläddra',
  eu: 'EU-rätt',
  // Law sub-routes
  historik: 'Ändringshistorik',
  version: 'Version',
  // EU types
  forordningar: 'Förordningar',
  direktiv: 'Direktiv',
}

// Segments that should be shown as intermediate links (not collapsed)
const showAsLink = new Set([
  'browse',
  'lagar',
  'eu',
  'forordningar',
  'direktiv',
  'historik',
  'version',
  'laglistor',
  'krav',
  'mallar',
  'filer',
  'styrdokument',
  // Story 21.5.2: cycle list hub exists at /laglistor/kontroller.
  'kontroller',
])

// Segments that should be hidden from the breadcrumb trail
const hiddenSegments = new Set(['edit', 'workspace'])

// Get a user-friendly label for a segment (truncate long slugs)
function getSegmentLabel(segment: string, _prevSegment?: string): string {
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
  const overrideLabel = useBreadcrumbOverrideStore((s) => s.label)

  // Split path and filter empty segments
  const segments = pathname.split('/').filter(Boolean)

  // Check if we're on the dashboard (root)
  const isDashboard =
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === 'dashboard')

  // Hide breadcrumbs on Hem page — chat-first layout needs full height
  if (isDashboard) return null

  // Build breadcrumb items with proper hierarchy
  const breadcrumbItems: Array<{ label: string; href?: string }> = []

  if (!isDashboard) {
    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      if (!segment) continue

      currentPath += `/${segment}`
      const isLast = i === segments.length - 1

      // Skip segments that should be hidden from breadcrumbs
      if (segment === 'browse' || hiddenSegments.has(segment)) continue

      const label = getSegmentLabel(
        segment,
        i > 0 ? segments[i - 1] : undefined
      )

      if (isLast) {
        // Last segment is current page (no link). Allow page-level override
        // (e.g. a law detail page showing "SFS 2026:311" instead of its slug).
        breadcrumbItems.push({ label: overrideLabel ?? label })
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

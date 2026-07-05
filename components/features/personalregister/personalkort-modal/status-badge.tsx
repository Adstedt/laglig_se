'use client'

/**
 * Employee Aktiv/Inaktiv status badge — tone-aware Badge API only
 * (DESIGN-001: status surfaces must never hand-roll legacy shadcn variants).
 * Shared by the entity header (DESIGN-002) and the compliance sidebar.
 */

import { Badge } from '@/components/ui/badge'

export function EmployeeStatusBadge({ inactive }: { inactive: boolean }) {
  return inactive ? (
    <Badge tone="neutral" variant="outline">
      Inaktiv
    </Badge>
  ) : (
    <Badge tone="success" variant="soft">
      Aktiv
    </Badge>
  )
}

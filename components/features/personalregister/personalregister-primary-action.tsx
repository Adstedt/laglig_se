'use client'

/**
 * Story 7.2: Primary action for the Personalregister page header.
 *
 * Mirrors the shape of Laglistor's `LawListPrimaryAction` (default-variant
 * small button + Plus icon) but writes the `?anstalld=ny` URL param instead
 * of opening a local modal — the create-mode modal itself is Story 7.3,
 * which mounts on that param ('ny' is the reserved create-mode sentinel).
 */

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PersonalregisterPrimaryActionProps {
  /** Only manage roles may add employees (contract for future role changes). */
  canManage: boolean
}

export function PersonalregisterPrimaryAction({
  canManage,
}: PersonalregisterPrimaryActionProps) {
  if (!canManage) return null

  const handleClick = () => {
    const params = new URLSearchParams(window.location.search)
    params.set('anstalld', 'ny')
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Plus className="mr-1.5 h-4 w-4" />
      Lägg till anställd
    </Button>
  )
}

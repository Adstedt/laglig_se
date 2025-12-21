import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Åtkomst nekad | Laglig',
  description: 'Du har inte behörighet att visa denna sida.',
}

/**
 * Story 5.2: Permission Denied Page
 * Displayed when user attempts to access a resource they lack permission for.
 */
export default function PermissionDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <ShieldX className="h-10 w-10 text-destructive" />
      </div>

      <h1 className="mb-2 text-2xl font-bold">Åtkomst nekad</h1>

      <p className="mb-6 max-w-md text-muted-foreground">
        Du har inte behörighet att utföra denna åtgärd. Kontakta din
        workspace-ägare om du behöver utökad åtkomst.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard">Tillbaka till dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/settings">Visa inställningar</Link>
        </Button>
      </div>
    </div>
  )
}

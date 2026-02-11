/**
 * Story 12.9: Custom 404 for template detail page
 */

import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function TemplateNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h2 className="text-lg font-semibold">Mallen kunde inte hittas</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Den mall du söker finns inte eller har inte publicerats ännu.
      </p>
      <Link
        href="/laglistor/mallar"
        className="mt-4 text-sm text-primary hover:underline"
      >
        Tillbaka till mallbiblioteket
      </Link>
    </div>
  )
}

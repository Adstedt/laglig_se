'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LawPageError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-16 text-center">
      <h2 className="mb-4 text-2xl font-bold">Något gick fel</h2>
      <p className="mb-6 text-muted-foreground">
        Vi kunde inte ladda denna lag. Försök igen eller gå tillbaka.
      </p>
      <div className="flex justify-center gap-4">
        <Button onClick={reset}>Försök igen</Button>
        <Button variant="outline" asChild>
          <Link href="/lagar">Tillbaka till lagar</Link>
        </Button>
      </div>
    </main>
  )
}

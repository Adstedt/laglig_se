import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Skapa workspace | Laglig.se',
  description: 'Skapa din workspace för att komma igång',
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; state?: string }>
}) {
  const { state } = await searchParams

  if (state === 'deleted') {
    return (
      <div>
        <h2 className="text-center font-safiro text-2xl font-semibold tracking-tight">
          Ditt workspace har raderats
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Du kan skapa ett nytt workspace nedan.
        </p>
        <Button className="mt-6 w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30">
          Skapa nytt workspace
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-center font-safiro text-2xl font-semibold tracking-tight">
        Skapa din workspace
      </h2>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Din workspace skapas i nästa steg.
      </p>
    </div>
  )
}

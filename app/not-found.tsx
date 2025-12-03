import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-6xl font-bold">404</h1>
      <h2 className="mb-4 text-xl text-muted-foreground">
        Sidan kunde inte hittas
      </h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        Dokumentet du söker finns inte eller har tagits bort.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button asChild>
          <Link href="/">Till startsidan</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/lagar">Sök bland lagar</Link>
        </Button>
      </div>
    </main>
  )
}

import Link from 'next/link'
import { Mail } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verifiera e-post | Laglig.se',
  description: 'Verifiera din e-postadress',
}

export default function VerifyEmailPage() {
  return (
    <div className="w-full text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-2xl font-bold font-safiro text-foreground">
        Kontrollera din e-post
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Vi har skickat en verifieringslänk till din e-postadress. Klicka på
        länken för att aktivera ditt konto.
      </p>
      <div className="mt-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Fick du inget mejl? Kontrollera din skräppost.
        </p>
        <Link
          href="/login"
          className="block text-sm font-medium text-primary hover:text-primary/80"
        >
          Tillbaka till inloggningen
        </Link>
      </div>
    </div>
  )
}

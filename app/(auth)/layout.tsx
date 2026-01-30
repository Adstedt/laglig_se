import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Konto | Laglig.se',
  description: 'Logga in eller skapa konto på Laglig.se',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-section-warm px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Image
              src="/images/logo-final.png"
              alt="Laglig.se"
              width={176}
              height={67}
              className="h-8 w-auto invert dark:invert-0"
              priority
            />
          </Link>
        </div>
        <Card className="animate-fade-up rounded-xl bg-card p-8 shadow-lg">
          {children}
        </Card>
      </div>
    </div>
  )
}

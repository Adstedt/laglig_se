import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Onboarding | Laglig.se',
  description: 'Skapa din workspace för att komma igång',
}

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user already has a workspace — if so, redirect to dashboard
  if (user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    })

    if (dbUser) {
      const existingMember = await prisma.workspaceMember.findFirst({
        where: { user_id: dbUser.id },
        include: { workspace: true },
      })

      if (existingMember && existingMember.workspace.status !== 'DELETED') {
        redirect('/dashboard')
      }
    }
  }

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

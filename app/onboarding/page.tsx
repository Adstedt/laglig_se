import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentUser } from '@/lib/auth/session'
import { getPendingInvitations } from '@/app/actions/invitations'
import { OnboardingWizard } from './_components/onboarding-wizard'

export const metadata: Metadata = {
  title: 'Skapa workspace | Laglig.se',
  description: 'Skapa din workspace för att komma igång',
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; state?: string }>
}) {
  const { redirect, state } = await searchParams

  // Fetch pending invitations for the authenticated user
  const user = await getCurrentUser()
  const invitations = user?.email ? await getPendingInvitations(user.email) : []

  return (
    <>
      <OnboardingWizard
        redirect={redirect}
        state={state}
        invitations={invitations}
      />
      <Toaster position="top-right" richColors />
    </>
  )
}

import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
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

  return (
    <>
      <OnboardingWizard redirect={redirect} state={state} />
      <Toaster position="top-right" richColors />
    </>
  )
}

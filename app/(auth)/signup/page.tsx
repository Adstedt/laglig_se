import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignupForm } from './_signup-form'

export const metadata: Metadata = {
  title: 'Skapa konto',
  description: 'Registrera dig på Laglig.se',
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

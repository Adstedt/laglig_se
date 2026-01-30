import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from './_login-form'

export const metadata: Metadata = {
  title: 'Logga in | Laglig.se',
  description: 'Logga in på ditt Laglig.se-konto',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Laddar...</div>}>
      <LoginForm />
    </Suspense>
  )
}

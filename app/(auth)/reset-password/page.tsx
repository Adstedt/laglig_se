import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from './_reset-password-form'

export const metadata: Metadata = {
  title: 'Återställ lösenord | Laglig.se',
  description: 'Återställ ditt lösenord',
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Laddar...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}

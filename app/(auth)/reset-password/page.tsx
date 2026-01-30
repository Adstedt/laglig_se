import type { Metadata } from 'next'
import { ResetPasswordForm } from './_reset-password-form'

export const metadata: Metadata = {
  title: 'Återställ lösenord | Laglig.se',
  description: 'Återställ ditt lösenord',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}

import type { Metadata } from 'next'
import { ConfirmPasswordForm } from './_confirm-password-form'

export const metadata: Metadata = {
  title: 'Nytt lösenord',
  description: 'Ange ditt nya lösenord',
}

export default function ConfirmResetPasswordPage() {
  return <ConfirmPasswordForm />
}

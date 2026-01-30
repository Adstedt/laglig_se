import type { Metadata } from 'next'
import { SignupForm } from './_signup-form'

export const metadata: Metadata = {
  title: 'Skapa konto | Laglig.se',
  description: 'Registrera dig på Laglig.se',
}

export default function SignupPage() {
  return <SignupForm />
}

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { ResetPasswordSchema } from '@/lib/validation/auth'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { z } from 'zod'

type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>

export function ResetPasswordForm() {
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>()

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true)
      setError('')

      const validated = ResetPasswordSchema.parse(data)

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        validated.email,
        {
          redirectTo: `${window.location.origin}/reset-password/confirm`,
        }
      )

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ett fel uppstod. Försök igen.')
      }
      // eslint-disable-next-line no-console
      console.error('Reset password error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold font-safiro text-foreground">
          Kontrollera din e-post
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Vi har skickat en länk för att återställa ditt lösenord.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Tillbaka till inloggningen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <h2 className="mt-2 text-3xl font-bold tracking-tight font-safiro text-foreground">
          Återställ ditt lösenord
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ange din e-postadress så skickar vi en länk för att återställa ditt
          lösenord.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="rounded-md bg-destructive/10 p-4">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-postadress</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="E-postadress"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          {isLoading ? 'Skickar...' : 'Skicka återställningslänk'}
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Tillbaka till inloggningen
          </Link>
        </div>
      </form>
    </div>
  )
}

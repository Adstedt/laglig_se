'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { SignupSchema } from '@/lib/validation/auth'
import { signupAction } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { z } from 'zod'

type SignupFormData = z.infer<typeof SignupSchema>

export function SignupForm() {
  const [error, setError] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>()

  const password = watch('password')

  const calculatePasswordStrength = (pwd: string): string => {
    if (!pwd) return ''
    const strength =
      (pwd.length >= 12 ? 1 : 0) +
      (/[A-Z]/.test(pwd) ? 1 : 0) +
      (/[a-z]/.test(pwd) ? 1 : 0) +
      (/[0-9]/.test(pwd) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(pwd) ? 1 : 0)

    if (strength < 3) return 'svag'
    if (strength < 5) return 'medel'
    return 'stark'
  }

  const strength = calculatePasswordStrength(password || '')

  const onSubmit = async (data: SignupFormData) => {
    try {
      setIsLoading(true)
      setError('')
      setFieldErrors({})

      // Client-side validation first (fast feedback)
      const clientValidation = SignupSchema.safeParse(data)
      if (!clientValidation.success) {
        const errors = clientValidation.error.flatten().fieldErrors
        setFieldErrors(errors as Record<string, string[]>)
        return
      }

      // Server-side validation and signup via Server Action
      const result = await signupAction(data)

      if (!result.success) {
        // Handle field-specific errors
        if (result.errors) {
          setFieldErrors(result.errors)
          // Show first error as general message
          const firstError = Object.values(result.errors)[0]?.[0]
          if (firstError) {
            setError(firstError)
          }
        } else if (result.message) {
          setError(result.message)
        }
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Ett oväntat fel uppstod. Försök igen.')
      // eslint-disable-next-line no-console
      console.error('Signup error:', err)
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
          Vi har skickat en verifieringslänk till din e-postadress. Klicka på
          länken för att aktivera ditt konto.
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
          Skapa ditt konto
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Har du redan ett konto?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            Logga in
          </Link>
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="rounded-md bg-destructive/10 p-4">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Fullständigt namn</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Fullständigt namn"
              {...register('name')}
            />
            {(errors.name ?? fieldErrors.name?.[0]) && (
              <p className="text-sm text-destructive">
                {errors.name?.message ?? fieldErrors.name?.[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-postadress</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="E-postadress"
              {...register('email')}
            />
            {(errors.email ?? fieldErrors.email?.[0]) && (
              <p className="text-sm text-destructive">
                {errors.email?.message ?? fieldErrors.email?.[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minst 12 tecken"
              {...register('password')}
            />
            {password && (
              <div className="mt-1 flex items-center gap-2">
                <div
                  className={`h-1 flex-1 rounded ${
                    strength === 'svag'
                      ? 'bg-red-500'
                      : strength === 'medel'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {strength}
                </span>
              </div>
            )}
            {(errors.password ?? fieldErrors.password?.[0]) && (
              <p className="text-sm text-destructive">
                {errors.password?.message ?? fieldErrors.password?.[0]}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Måste innehålla versal, gemen, siffra och specialtecken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Bekräfta lösenord"
              {...register('confirmPassword')}
            />
            {(errors.confirmPassword ?? fieldErrors.confirmPassword?.[0]) && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword?.message ??
                  fieldErrors.confirmPassword?.[0]}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          {isLoading ? 'Skapar konto...' : 'Skapa konto'}
        </Button>
      </form>
    </div>
  )
}

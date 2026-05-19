'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LoginSchema } from '@/lib/validation/auth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { GoogleSignInButton } from '@/components/features/auth/google-signin-button'
import type { z } from 'zod'

type LoginFormData = z.infer<typeof LoginSchema>

const REMEMBER_EMAIL_KEY = 'laglig-remember-email'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: 'Verifieringslänken är ogiltig eller har gått ut',
  verification_failed:
    'E-postverifieringen misslyckades. Försök igen eller begär en ny verifieringslänk',
  // NOTE: 'Password' key displays a success message via ?error= param (legacy from reset-password confirm flow)
  Password: 'Lösenordet har uppdaterats. Logga in med ditt nya lösenord',
  email_exists_with_password:
    'Den här e-postadressen är redan registrerad med ett lösenord. Logga in med ditt lösenord eller kontakta support för att länka kontona.',
  oauth_failed:
    'Inloggning med Google misslyckades. Försök igen eller logga in med e-post och lösenord.',
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>()

  // Check for error or success messages and email prefill from URL parameters
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    const messageParam = searchParams?.get('message')
    const emailParam = searchParams?.get('email')

    if (errorParam && ERROR_MESSAGES[errorParam]) {
      setError(ERROR_MESSAGES[errorParam])
    }

    if (messageParam) {
      setSuccessMessage(messageParam)
    }

    // Prefill email from URL (e.g. after email verification)
    if (emailParam) {
      setValue('email', emailParam)
    }
  }, [searchParams, setValue])

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY)
    if (savedEmail) {
      setValue('email', savedEmail)
      setRememberMe(true)
    }
  }, [setValue])

  const callbackUrl =
    searchParams?.get('callbackUrl') ||
    searchParams?.get('redirect') ||
    '/dashboard'

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      setError('')

      // Validate with Zod
      const validated = LoginSchema.parse(data)

      // Pass an explicit callbackUrl so next-auth/react does not fall back
      // to window.location.href. If the user landed here via /auth/verify's
      // failure redirect (/login?error=verification_failed), that fallback
      // would echo the `?error=` back in the success-redirect URL, which
      // next-auth/react then misreads as a CredentialsSignin failure even
      // though the session cookie was set.
      const result = await signIn('credentials', {
        email: validated.email,
        password: validated.password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('Ogiltig e-postadress eller lösenord')
        return
      }

      // Persist or clear remembered email
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, validated.email)
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }

      // Redirect to dashboard or callback URL
      // Use hard navigation to bypass Next.js Router Cache after auth state change
      window.location.href = callbackUrl
    } catch (err) {
      setError('Ett fel uppstod. Försök igen.')
      // eslint-disable-next-line no-console
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <h2 className="mt-2 text-3xl font-medium tracking-tight font-safiro text-foreground">
          Logga in på ditt konto
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Eller{' '}
          <Link
            href="/signup"
            className="font-medium text-primary hover:text-primary/80"
          >
            Skapa ett nytt konto
          </Link>
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {successMessage && (
          <div className="rounded-md bg-emerald-50 p-4">
            <div className="text-sm text-emerald-800">{successMessage}</div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-4">
            <div className="text-sm text-destructive">{error}</div>
          </div>
        )}

        <GoogleSignInButton
          mode="login"
          callbackUrl={callbackUrl}
          onError={setError}
        />

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase text-muted-foreground">
            eller
          </span>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
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
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Lösenord"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label
                htmlFor="remember-me"
                className="text-sm font-normal cursor-pointer"
              >
                Kom ihåg min e-post
              </Label>
            </div>
            <div className="text-sm">
              <Link
                href="/reset-password"
                className="font-medium text-primary hover:text-primary/80"
              >
                Glömt ditt lösenord?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
          >
            {isLoading ? 'Loggar in...' : 'Logga in'}
          </Button>
        </form>
      </div>
    </div>
  )
}

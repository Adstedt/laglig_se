'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { ConfirmPasswordSchema } from '@/lib/validation/auth'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { z } from 'zod'

type ConfirmPasswordFormData = z.infer<typeof ConfirmPasswordSchema>

export function ConfirmPasswordForm() {
  const router = useRouter()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmPasswordFormData>()

  const onSubmit = async (data: ConfirmPasswordFormData) => {
    try {
      setIsLoading(true)
      setError('')

      const validated = ConfirmPasswordSchema.parse(data)

      const { error: updateError } = await supabase.auth.updateUser({
        password: validated.password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Redirect to login with success message
      router.push('/login?message=Lösenordet har uppdaterats')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ett fel uppstod. Försök igen.')
      }
      // eslint-disable-next-line no-console
      console.error('Confirm password error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="text-center">
        <h2 className="mt-2 text-3xl font-bold tracking-tight font-safiro text-foreground">
          Ange nytt lösenord
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ange ditt nya lösenord nedan.
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
            <Label htmlFor="password">Nytt lösenord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minst 12 tecken"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Måste innehålla versal, gemen, siffra och specialtecken
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Bekräfta nytt lösenord</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Bekräfta nytt lösenord"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          {isLoading ? 'Uppdaterar lösenord...' : 'Uppdatera lösenord'}
        </Button>
      </form>
    </div>
  )
}

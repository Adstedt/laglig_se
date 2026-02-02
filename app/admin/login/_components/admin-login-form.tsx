'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminLogin } from '@/app/actions/admin-auth'

type LoginState = {
  success: boolean
  error?: string | undefined
}

const initialState: LoginState = { success: false }

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: LoginState, formData: FormData) => {
      return adminLogin(formData)
    },
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-2xl">Admin</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@laglig.se"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Loggar in...' : 'Logga in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

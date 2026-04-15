import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Returns `next` if it looks like a same-origin relative path. Anything else
 * is discarded to prevent open-redirect (a forged email could otherwise route
 * a verified user to an attacker-controlled URL via ?next=https://evil.com).
 */
function safeNext(next: string | null): string | null {
  if (!next) return null
  if (!next.startsWith('/')) return null
  if (next.startsWith('//')) return null // protocol-relative
  return next
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const email = searchParams.get('email')
  const next = safeNext(searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    )
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'signup' | 'email',
    })

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Email verification error:', error.message)
      return NextResponse.redirect(
        new URL('/login?error=verification_failed', request.url)
      )
    }

    // Redirect to login with email prefilled and success message. When `next`
    // was carried through from emailRedirectTo (Story 5.3: invite flow), pass
    // it along as the login `callbackUrl` so the user lands back at
    // /invite/<token> after logging in.
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'message',
      'E-post verifierad! Logga in med ditt konto.'
    )
    if (email) {
      loginUrl.searchParams.set('email', email)
    }
    if (next) {
      loginUrl.searchParams.set('callbackUrl', next)
    }
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unexpected verification error:', error)
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', request.url)
    )
  }
}

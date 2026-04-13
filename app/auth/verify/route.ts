import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const email = searchParams.get('email')

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

    // Redirect to login with email prefilled and success message
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'message',
      'E-post verifierad! Logga in med ditt konto.'
    )
    if (email) {
      loginUrl.searchParams.set('email', email)
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

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    // eslint-disable-next-line no-console
    console.error('Email verification callback: missing code parameter')
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    )
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Email verification error:', error.message)
      return NextResponse.redirect(
        new URL('/login?error=verification_failed', request.url)
      )
    }

    // Redirect to dashboard after successful verification
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unexpected callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', request.url)
    )
  }
}

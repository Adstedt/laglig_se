import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

/**
 * The token_hash in the email is one-time use, and corporate mail security
 * (Outlook Safe Links etc.) prefetches links before the user clicks. That
 * prefetch consumes the token and verifies the account, so the user's real
 * click hits an already-used token and verifyOtp fails — even though the
 * account is verified and login works. When that happens, check whether the
 * account is in fact confirmed and treat it as success instead of showing a
 * bogus failure.
 */
async function isEmailAlreadyConfirmed(email: string | null): Promise<boolean> {
  if (!email) return false
  try {
    const rows = await prisma.$queryRaw<{ email_confirmed_at: Date | null }[]>`
      SELECT email_confirmed_at FROM auth.users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `
    return rows[0]?.email_confirmed_at != null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not check email confirmation status:', error)
    return false
  }
}

function successRedirect(
  request: NextRequest,
  email: string | null,
  next: string | null
): NextResponse {
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
      if (await isEmailAlreadyConfirmed(email)) {
        return successRedirect(request, email, next)
      }
      // eslint-disable-next-line no-console
      console.error('Email verification error:', error.message)
      return NextResponse.redirect(
        new URL('/login?error=verification_failed', request.url)
      )
    }

    return successRedirect(request, email, next)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unexpected verification error:', error)
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', request.url)
    )
  }
}

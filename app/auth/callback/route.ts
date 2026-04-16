import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getNextAuthCookieName } from '@/lib/admin/auth'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days — matches authOptions.session.maxAge

/**
 * Validates a redirect path is safe (relative, no open-redirect).
 * Must start with `/` and must NOT start with `//` or `/\`.
 */
function getSafeRedirectPath(next: string | null): string {
  if (!next) return '/dashboard'
  if (/^\/(?![/\\])/.test(next)) return next
  return '/dashboard'
}

/**
 * Creates a NextAuth-compatible JWT session and sets the cookie.
 * Reuses the pattern from app/actions/admin-impersonate.ts:46–81.
 */
async function createNextAuthSessionForSupabaseUser(user: {
  id: string
  email: string
  name: string | null
}) {
  const sessionToken = await encode({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      sub: user.id,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  })

  const cookieStore = await cookies()
  cookieStore.set(getNextAuthCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

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

    // Check if this is an OAuth sign-in (has a `next` param from our GoogleSignInButton)
    // or a plain email-verification callback (no `next` param).
    // For email verification, the existing redirect-to-dashboard behaviour is preserved.
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    if (!supabaseUser) {
      // Exchange succeeded but no user — shouldn't happen, but handle gracefully
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // --- OAuth bridge: upsert Prisma user + mint NextAuth session ---

    // 6.4: Email-collision pre-check (runs BEFORE any Prisma write)
    const existingUser = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      select: { id: true },
    })

    if (existingUser && existingUser.id !== supabaseUser.id) {
      // Different Supabase user with same email — reject, don't merge
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL('/login?error=email_exists_with_password', request.url)
      )
    }

    // 6.5: Prisma upsert (keyed on id, not email)
    const userName =
      supabaseUser.user_metadata?.full_name ??
      supabaseUser.user_metadata?.name ??
      null

    const prismaUser = await prisma.user.upsert({
      where: { id: supabaseUser.id },
      create: {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: userName,
        email_verified: supabaseUser.email_confirmed_at !== null,
        last_login_at: new Date(),
      },
      update: {
        last_login_at: new Date(),
        // Only update name if currently null
        ...(existingUser ? {} : { name: userName }),
      },
      select: { id: true, email: true, name: true },
    })

    // 6.6 + 6.7: Mint NextAuth JWT + set session cookie
    await createNextAuthSessionForSupabaseUser({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
    })

    // 6.8: Redirect to validated next path
    const redirectPath = getSafeRedirectPath(next)
    return NextResponse.redirect(new URL(redirectPath, request.url))
  } catch (error) {
    // 6.9: Catch-all error handler
    // eslint-disable-next-line no-console
    console.error('OAuth bridge error:', {
      code: 'OAUTH_BRIDGE_FAILURE',
      error: error instanceof Error ? error.message : String(error),
    })

    // Best-effort cleanup of Supabase session
    try {
      const supabase = await createServerSupabaseClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore signOut errors in the error path
    }

    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', request.url)
    )
  }
}
